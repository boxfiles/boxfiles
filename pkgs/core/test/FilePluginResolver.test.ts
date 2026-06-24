import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  FilePluginResolveError,
  parsePluginSource,
  resolveFilePluginSource,
  type FilePluginSource,
} from "../../plugin/src/index";

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.map((root) => rm(root, { recursive: true, force: true })));
  createdRoots.length = 0;
});

describe("resolveFilePluginSource", () => {
  test("resolves relative file sources from the .boxfilesrc directory", async () => {
    const context = await createContext("relative");
    const pluginRoot = join(context.configDir, "plugins", "local-copy");
    await createPackagePlugin(pluginRoot, "./src/index.ts");

    const artifact = await resolveFilePluginSource(expectFileSource(parsePluginSource("file:./plugins/local-copy")), {
      configPath: context.configPath,
    });

    expect(artifact).toEqual({
      kind: "file",
      path: pluginRoot,
      entryPath: join(pluginRoot, "src", "index.ts"),
      source: { kind: "file", path: "./plugins/local-copy" },
      local: true,
      nonReproducible: true,
    });
  });

  test("preserves absolute file source paths", async () => {
    const context = await createContext("absolute");
    const pluginRoot = join(context.root, "elsewhere", "plugin");
    await createPackagePlugin(pluginRoot, "./index.ts");

    const artifact = await resolveFilePluginSource({ kind: "file", path: pluginRoot }, {
      configPath: context.configPath,
    });

    expect(artifact.path).toBe(pluginRoot);
    expect(artifact.entryPath).toBe(join(pluginRoot, "index.ts"));
    expect(artifact.local).toBe(true);
    expect(artifact.nonReproducible).toBe(true);
  });

  test("throws for missing local paths", async () => {
    const context = await createContext("missing");

    await expect(resolveFilePluginSource({ kind: "file", path: "./plugins/missing" }, {
      configPath: context.configPath,
    })).rejects.toThrow(FilePluginResolveError);
    await expect(resolveFilePluginSource({ kind: "file", path: "./plugins/missing" }, {
      configPath: context.configPath,
    })).rejects.toThrow(/does not exist/u);
  });

  test("throws for invalid plugin entry shape", async () => {
    const context = await createContext("entry-shape");
    const pluginRoot = join(context.configDir, "plugins", "bad-entry");
    await mkdir(pluginRoot, { recursive: true });
    await writeFile(join(pluginRoot, "package.json"), JSON.stringify({ name: "bad-entry" }));

    await expect(resolveFilePluginSource({ kind: "file", path: "./plugins/bad-entry" }, {
      configPath: context.configPath,
    })).rejects.toThrow(/must declare a string exports, exports\["\."\], or main entry/u);
  });


  test("throws when package entry escapes the plugin directory", async () => {
    const context = await createContext("entry-escape");
    const pluginRoot = join(context.configDir, "plugins", "escaping-entry");
    await mkdir(pluginRoot, { recursive: true });
    await writeFile(join(context.configDir, "plugins", "escape.ts"), "export default {};\n");
    await writeFile(join(pluginRoot, "package.json"), JSON.stringify({ main: "../escape.ts" }));

    await expect(resolveFilePluginSource({ kind: "file", path: "./plugins/escaping-entry" }, {
      configPath: context.configPath,
    })).rejects.toThrow(/must stay inside the plugin directory/u);
  });

  test("does not populate XDG cache or write outside provided local plugin files", async () => {
    const context = await createContext("no-cache");
    const pluginRoot = join(context.configDir, "plugins", "local-only");
    await mkdir(join(pluginRoot, "src"), { recursive: true });
    await writeFile(join(pluginRoot, "src", "index.ts"), "export default { id: 'local-only' };\n");

    const artifact = await resolveFilePluginSource({ kind: "file", path: "./plugins/local-only" }, {
      configPath: context.configPath,
    });

    expect(artifact.path).toBe(pluginRoot);
    await expect(stat(context.xdgCacheHome)).rejects.toThrow();
    await expect(stat(join(context.root, "home"))).rejects.toThrow();
  });
});

async function createContext(name: string): Promise<{
  readonly root: string;
  readonly configDir: string;
  readonly configPath: string;
  readonly xdgCacheHome: string;
}> {
  const root = join(tmpdir(), `boxfiles-file-plugin-resolver-${name}-${crypto.randomUUID()}`);
  const configDir = join(root, "project", "nested");
  await mkdir(configDir, { recursive: true });
  const configPath = join(configDir, ".boxfilesrc");
  await writeFile(configPath, "{\"plugins\":{}}\n");
  createdRoots.push(root);
  return {
    root,
    configDir,
    configPath,
    xdgCacheHome: join(root, "xdg-cache"),
  };
}

async function createPackagePlugin(pluginRoot: string, entry: string): Promise<void> {
  await mkdir(join(pluginRoot, "src"), { recursive: true });
  const entryPath = entry.endsWith("index.ts") && entry.includes("src")
    ? join(pluginRoot, "src", "index.ts")
    : join(pluginRoot, "index.ts");
  await writeFile(entryPath, "export default { id: 'local-plugin' };\n");
  await writeFile(join(pluginRoot, "package.json"), JSON.stringify({ exports: { ".": entry } }));
}

function expectFileSource(source: ReturnType<typeof parsePluginSource>): FilePluginSource {
  if (source.kind !== "file") throw new Error("Expected file source");
  return source;
}
