import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import {
  ContextService,
  getPluginCacheEntry,
  loadInstalledPlugins,
  parsePluginSource,
  PluginService,
} from "../src/index";

describe("loadInstalledPlugins", () => {
  test("fails when an npm declaration has no cached artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "boxfiles-loader-missing-"));
    const cacheHome = await mkdtemp(join(tmpdir(), "boxfiles-loader-cache-"));
    const source = "npm:boxfiles-plugin-missing@1.0.0";
    const cacheEntry = getPluginCacheEntry(parsePluginSource(source), { env: { XDG_CACHE_HOME: cacheHome } });
    if (cacheEntry === null) throw new Error("Expected cache entry for npm source");

    await writeFile(join(root, ".boxfilesrc"), `${JSON.stringify({ plugins: { missing: source } })}\n`);
    const pluginService = new PluginService(root);

    await expect(loadInstalledPlugins({
      rootDir: root,
      pluginService,
      cache: { env: { XDG_CACHE_HOME: cacheHome } },
    })).rejects.toThrow(`Installed plugin cache entry is missing: ${cacheEntry.path}`);
  });

  test("loads an npm plugin from its cached artifact without running context resolvers", async () => {
    const root = await mkdtemp(join(tmpdir(), "boxfiles-loader-npm-"));
    const cacheHome = await mkdtemp(join(tmpdir(), "boxfiles-loader-cache-"));
    const markerPath = join(root, "npm-resolver-ran.txt");
    const source = "npm:@boxfiles/plugin-remote@1.2.3";
    const cacheEntry = getPluginCacheEntry(parsePluginSource(source), { env: { XDG_CACHE_HOME: cacheHome } });
    if (cacheEntry === null) throw new Error("Expected cache entry for npm source");

    await writeFile(join(root, ".boxfilesrc"), `${JSON.stringify({ plugins: { remote: source } })}\n`);
    await writeCachedPlugin(cacheEntry.path, markerPath, "npm-plugin", "npm.fact", "npm.action");

    const pluginService = new PluginService(root);
    const loaded = await loadInstalledPlugins({
      rootDir: root,
      pluginService,
      cache: { env: { XDG_CACHE_HOME: cacheHome } },
    });

    expect(loaded).toEqual([{ name: "remote", source, kind: "npm", entryPath: join(cacheEntry.path, "index.js") }]);
    expect(pluginService.getActionProvider("npm.action")?.kind).toBe("npm.action");
    expect(pluginService.listPlugins()).toContainEqual({
      id: "npm-plugin",
      source: "npm",
      contextKeys: ["npm.fact"],
      actionKinds: ["npm.action"],
    });
    expect(existsSync(markerPath)).toBe(false);

    const contextService = ContextService.create();
    const gathered = await pluginService.gatherContextFacts(contextService);

    expect(gathered.map((fact) => fact.key)).toEqual([ContextService.factKey("npm.fact")]);
    expect(contextService.snapshot()).toEqual({ "npm.fact": "resolved" });
    expect(await readFile(markerPath, "utf8")).toBe("resolver executed");
  });

  test("loads a git plugin from its cached artifact without running context resolvers", async () => {
    const root = await mkdtemp(join(tmpdir(), "boxfiles-loader-git-"));
    const cacheHome = await mkdtemp(join(tmpdir(), "boxfiles-loader-cache-"));
    const markerPath = join(root, "git-resolver-ran.txt");
    const source = "git:https://example.com/acme/boxfiles-plugin.git#v1.2.3";
    const cacheEntry = getPluginCacheEntry(parsePluginSource(source), { env: { XDG_CACHE_HOME: cacheHome } });
    if (cacheEntry === null) throw new Error("Expected cache entry for git source");

    await writeFile(join(root, ".boxfilesrc"), `${JSON.stringify({ plugins: { remote: source } })}\n`);
    await writeCachedPlugin(cacheEntry.path, markerPath, "git-plugin", "git.fact", "git.action");

    const pluginService = new PluginService(root);
    const loaded = await loadInstalledPlugins({
      rootDir: root,
      pluginService,
      cache: { env: { XDG_CACHE_HOME: cacheHome } },
    });

    expect(loaded).toEqual([{ name: "remote", source, kind: "git", entryPath: join(cacheEntry.path, "index.js") }]);
    expect(pluginService.getActionProvider("git.action")?.kind).toBe("git.action");
    expect(pluginService.listPlugins()).toContainEqual({
      id: "git-plugin",
      source: "git",
      contextKeys: ["git.fact"],
      actionKinds: ["git.action"],
    });
    expect(existsSync(markerPath)).toBe(false);

    const contextService = ContextService.create();
    const gathered = await pluginService.gatherContextFacts(contextService);

    expect(gathered.map((fact) => fact.key)).toEqual([ContextService.factKey("git.fact")]);
    expect(contextService.snapshot()).toEqual({ "git.fact": "resolved" });
    expect(await readFile(markerPath, "utf8")).toBe("resolver executed");
  });

  test("loads a local file plugin with action and context capabilities without running context resolvers", async () => {
    const root = await mkdtemp(join(tmpdir(), "boxfiles-loader-local-"));
    const pluginDir = join(root, "plugins", "local");
    const markerPath = join(root, "resolver-ran.txt");

    await mkdir(pluginDir, { recursive: true });
    await writeFile(join(root, ".boxfilesrc"), `${JSON.stringify({ plugins: { local: "file:./plugins/local" } })}\n`);
    await writeFile(join(pluginDir, "package.json"), `${JSON.stringify({ type: "module", exports: "./index.js" })}\n`);
    await writeFile(join(pluginDir, "index.js"), pluginModuleSource(markerPath));

    const pluginService = new PluginService(root);
    const loaded = await loadInstalledPlugins({ rootDir: root, pluginService });

    expect(loaded).toHaveLength(1);
    expect(pluginService.getActionProvider("local.action")?.kind).toBe("local.action");
    expect(pluginService.listPlugins()).toContainEqual({
      id: "local-plugin",
      source: "file",
      contextKeys: ["local.fact"],
      actionKinds: ["local.action"],
    });
    expect(existsSync(markerPath)).toBe(false);

    const contextService = ContextService.create();
    const gathered = await pluginService.gatherContextFacts(contextService);

    expect(gathered.map((fact) => fact.key)).toEqual([ContextService.factKey("local.fact")]);
    expect(contextService.snapshot()).toEqual({ "local.fact": "resolved" });
    expect(await readFile(markerPath, "utf8")).toBe("resolver executed");
  });
});

async function writeCachedPlugin(
  pluginDir: string,
  markerPath: string,
  pluginId: string,
  factKey: string,
  actionKind: string,
): Promise<void> {
  await mkdir(pluginDir, { recursive: true });
  await writeFile(join(pluginDir, "package.json"), `${JSON.stringify({ type: "module", exports: "./index.js" })}\n`);
  await writeFile(join(pluginDir, "index.js"), pluginModuleSource(markerPath, pluginId, factKey, actionKind));
}

function pluginModuleSource(markerPath: string, pluginId = "local-plugin", factKey = "local.fact", actionKind = "local.action"): string {
  return `
import { writeFileSync } from "node:fs";

export default {
  id: ${JSON.stringify(pluginId)},
  context: {
    [${JSON.stringify(factKey)}]: () => {
      writeFileSync(${JSON.stringify(markerPath)}, "resolver executed");
      return "resolved";
    },
  },
  actions: {
    localAction: {
      kind: ${JSON.stringify(actionKind)},
      schema: {},
      validate(config) {
        return { success: true, value: config };
      },
      async plan(input) {
        return {
          actionId: input.action.id,
          manifestId: input.action.manifestId,
          kind: input.action.uses,
          summary: "local plan",
          safety: { idempotent: true, unsafe: false },
          changes: [],
        };
      },
      async apply(input) {
        return { actionId: input.action.id, success: true };
      },
    },
  },
};
`;
}
