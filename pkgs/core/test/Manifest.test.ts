import { describe, expect, test } from "bun:test";
import { Volume } from "memfs";
import * as path from "node:path";
import copy from "../../provider-copy/src/index.ts";
import {
  ManifestService,
  type ManifestDirectoryEntry,
  type ManifestFileSystem,
  PluginService,
} from "@boxfiles/core";

type ManifestTestHarness = {
  readonly rootDir: string;
  readonly service: ManifestService;
  readonly writeManifest: (relativePath: string, content: string) => Promise<void>;
};

function createManifestTestHarness(): ManifestTestHarness {
  const rootDir = "/boxfiles";
  const volume = new Volume();
  volume.mkdirSync(rootDir, { recursive: true });

  const fileSystem = createManifestFileSystem(volume);
  const pluginService = new PluginService(rootDir);
  pluginService.registerPlugin(copy, "builtin");

  return {
    rootDir,
    service: new ManifestService(rootDir, pluginService, fileSystem),
    writeManifest: async (relativePath, content) => {
      const fullPath = path.posix.join(rootDir, relativePath);
      volume.mkdirSync(path.posix.dirname(fullPath), { recursive: true });
      volume.writeFileSync(fullPath, content, { encoding: "utf-8" });
    },
  };
}

function createManifestFileSystem(volume: Volume): ManifestFileSystem {
  return {
    readFile: async (filePath, encoding) => {
      const content = await volume.promises.readFile(filePath, encoding);
      return String(content);
    },
    readdir: async (dirPath, options) => {
      const entries: readonly unknown[] = await volume.promises.readdir(dirPath, options);
      return entries.filter(isManifestDirectoryEntry);
    },
    stat: async (filePath) => await volume.promises.stat(filePath),
  };
}

function isManifestDirectoryEntry(value: unknown): value is ManifestDirectoryEntry {
  if (typeof value !== "object" || value === null) return false;
  if (!("name" in value) || typeof value.name !== "string") return false;
  if (!("isDirectory" in value) || typeof value.isDirectory !== "function") return false;
  return "isFile" in value && typeof value.isFile === "function";
}

describe("ManifestService.discover", () => {
  test("discovers manifest files in demo directories", async () => {
    const harness = createManifestTestHarness();
    await harness.writeManifest(
      "demo/workstation.yaml",
      `steps:
  - uses: copy
    with:
      from: workstation.txt
      to: ~/.workstation
`,
    );

    const manifestPaths = await harness.service.discover();

    expect(manifestPaths.map((manifestPath) => path.posix.relative(harness.rootDir, manifestPath))).toEqual([
      "demo/workstation.yaml",
    ]);
  });

  test("discovers manifest contexts in discovery order", async () => {
    const harness = createManifestTestHarness();
    await harness.writeManifest("demo/workstation.yaml", "steps: []\n");

    const contexts = await harness.service.discoverContexts();

    expect(
      contexts.map((manifest) => ({
        id: String(manifest.id),
        path: manifest.path,
        dir: manifest.dir,
        filesDir: manifest.filesDir,
      })),
    ).toEqual([
      {
        id: "demo.workstation",
        path: "demo/workstation.yaml",
        dir: "demo",
        filesDir: "demo/files",
      },
    ]);
  });


  test("ignores hidden boxfilesrc config files anywhere", async () => {
    const harness = createManifestTestHarness();
    await harness.writeManifest("boxfiles.yaml", "steps: []\n");
    await harness.writeManifest("boxfile.yaml", "steps: []\n");
    await harness.writeManifest(".boxfilesrc.yaml", "plugins: []\n");
    await harness.writeManifest("modules/.boxfilesrc.toml", "plugins = []\n");
    await harness.writeManifest("modules/boxfiles.yaml", "steps: []\n");

    const manifestPaths = await harness.service.discover();

    expect(manifestPaths.map((manifestPath) => path.posix.relative(harness.rootDir, manifestPath))).toEqual([
      "boxfile.yaml",
      "boxfiles.yaml",
      "modules/boxfiles.yaml",
    ]);
  });
});
describe("ManifestService.plan", () => {
  test("compiles valid manifests in dependency order with manifest context", async () => {
    const harness = createManifestTestHarness();
    await harness.writeManifest(
      "modules/base.yaml",
      `steps:
  - id: base-copy
    uses: copy
    with:
      from: base.txt
      to: ~/.base
`,
    );
    await harness.writeManifest(
      "modules/git.yaml",
      `dependsOn:
  - modules.base
steps:
  - id: git-copy
    uses: copy
    with:
      from: gitconfig
      to: ~/.gitconfig
`,
    );

    const plan = await harness.service.plan({ facts: {} });

    expect(plan.actions.map((action) => String(action.actionId))).toEqual(["base-copy", "git-copy"]);
    expect(plan.manifests.map((manifest) => String(manifest.id))).toEqual([
      "modules.base",
      "modules.git",
    ]);
    const firstManifest = plan.manifests[0]?.manifest;
    expect(firstManifest).toBeDefined();
    if (!firstManifest) throw new Error("Expected first manifest");
    expect({
      id: String(firstManifest.id),
      path: firstManifest.path,
      dir: firstManifest.dir,
      filesDir: firstManifest.filesDir,
    }).toEqual({
      id: "modules.base",
      path: "modules/base.yaml",
      dir: "modules",
      filesDir: "modules/files",
    });
    expect(plan.manifests[1]?.steps[0]?.config).toEqual({
      from: "gitconfig",
      to: "~/.gitconfig",
    });
  });


  test("resolves manifest dependencies relative to the current manifest namespace", async () => {
    const harness = createManifestTestHarness();
    await harness.writeManifest(
      "demo/base/foundation.yaml",
      `steps: []
`,
    );
    await harness.writeManifest(
      "demo/applications/package-catalog.yaml",
      `dependsOn:
  - base.foundation
steps: []
`,
    );

    const plan = await harness.service.plan({ facts: {} });

    expect(plan.manifests.map((manifest) => String(manifest.id))).toEqual([
      "demo.base.foundation",
      "demo.applications.package-catalog",
    ]);
    expect(plan.manifests[1]?.dependsOn.map((dependencyId) => String(dependencyId))).toEqual([
      "demo.base.foundation",
    ]);
  });

  test("fails loudly for ambiguous manifest dependency references", async () => {
    const harness = createManifestTestHarness();
    await harness.writeManifest(
      "base/foundation.yaml",
      `steps: []
`,
    );
    await harness.writeManifest(
      "demo/base/foundation.yaml",
      `steps: []
`,
    );
    await harness.writeManifest(
      "demo/applications/package-catalog.yaml",
      `dependsOn:
  - base.foundation
steps: []
`,
    );

    await expect(harness.service.plan({ facts: {} })).rejects.toThrow(
      "Manifest demo.applications.package-catalog dependency base.foundation is ambiguous: base.foundation, demo.base.foundation",
    );
  });

  test("fails loudly for unknown action provider", async () => {
    const harness = createManifestTestHarness();
    await harness.writeManifest(
      "broken.yaml",
      `steps:
  - uses: nope
    with: {}
`,
    );

    await expect(harness.service.plan({ facts: {} })).rejects.toThrow(
      "No provider registered for action kind: nope",
    );
  });

  test("fails loudly for invalid provider config", async () => {
    const harness = createManifestTestHarness();
    await harness.writeManifest(
      "broken.yaml",
      `steps:
  - uses: copy
    with:
      from: files/bad
      to: ~/.bad
`,
    );

    await expect(harness.service.plan({ facts: {} })).rejects.toThrow(
      "copy.from is relative to the manifest files directory",
    );
  });

  test("fails loudly for missing dependencies", async () => {
    const harness = createManifestTestHarness();
    await harness.writeManifest(
      "dependent.yaml",
      `dependsOn:
  - missing
steps: []
`,
    );

    await expect(harness.service.plan({ facts: {} })).rejects.toThrow(
      "Manifest dependent depends on missing manifest: missing",
    );
  });


  test("deduplicates duplicate dependency candidates for one unique manifest", async () => {
    const harness = createManifestTestHarness();
    await harness.writeManifest(
      "base/foundation.yaml",
      `steps: []
`,
    );
    await harness.writeManifest(
      "applications/package-catalog.yaml",
      `dependsOn:
  - base.foundation
steps: []
`,
    );

    const plan = await harness.service.plan({ facts: {} });

    expect(plan.manifests.map((manifest) => String(manifest.id))).toEqual([
      "base.foundation",
      "applications.package-catalog",
    ]);
    expect(plan.manifests[1]?.dependsOn.map((dependencyId) => String(dependencyId))).toEqual([
      "base.foundation",
    ]);
  });

  test("fails loudly for dependency cycles", async () => {
    const harness = createManifestTestHarness();
    await harness.writeManifest(
      "a.yaml",
      `dependsOn:
  - b
steps: []
`,
    );
    await harness.writeManifest(
      "b.yaml",
      `dependsOn:
  - a
steps: []
`,
    );

    await expect(harness.service.plan({ facts: {} })).rejects.toThrow(
      "Manifest dependency cycle detected at: a",
    );
  });
});
