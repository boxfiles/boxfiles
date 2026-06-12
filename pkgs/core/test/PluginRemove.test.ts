import { describe, expect, test } from "bun:test";
import { getPluginCacheEntry, parsePluginSource, removePluginDeclaration, type PluginRemoveFileSystem } from "../src/index";

describe("removePluginDeclaration", () => {
  test("removes declaration and keeps cache by default", async () => {
    const events: string[] = [];
    const fs = createConfigFs(events, { plugins: { demo: "npm:plugin-demo@1.0.0" } });
    const removed: string[] = [];

    const result = await removePluginDeclaration("demo", {
      rootDir: "/workspace/project",
      fs,
      rm: async (path) => { removed.push(path); },
      cache: { env: { XDG_CACHE_HOME: "/cache" } },
    });

    expect(events).toEqual(["read", "write"]);
    expect(removed).toEqual([]);
    expect(result.purged).toBe(false);
    expect(result.purgeSkippedReason).toBe("not-requested");
    expect(readWrittenConfig(fs)).toEqual({});
  });

  test("purge deletes npm cache when no remaining declaration references it", async () => {
    const events: string[] = [];
    const source = "npm:plugin-demo@1.0.0";
    const fs = createConfigFs(events, { settings: { plugins: { allowRemote: true } }, plugins: { demo: source, other: "git:https://example.com/org/other.git" } });
    const removed: string[] = [];

    const result = await removePluginDeclaration("demo", {
      rootDir: "/workspace/project",
      fs,
      purge: true,
      rm: async (path) => { removed.push(path); },
      cache: { env: { XDG_CACHE_HOME: "/cache" } },
    });

    expect(result.purged).toBe(true);
    expect(removed).toEqual([cachePath(source)]);
    expect(readWrittenConfig(fs)).toEqual({ settings: { plugins: { allowRemote: true } }, plugins: { other: "git:https://example.com/org/other.git" } });
  });

  test("purge deletes git cache when no remaining declaration references it", async () => {
    const source = "git:https://example.com/org/plugin.git#v1";
    const fs = createConfigFs([], { plugins: { demo: source } });
    const removed: string[] = [];

    const result = await removePluginDeclaration("demo", {
      rootDir: "/workspace/project",
      fs,
      purge: true,
      rm: async (path) => { removed.push(path); },
      cache: { env: { XDG_CACHE_HOME: "/cache" } },
    });

    expect(result.purged).toBe(true);
    expect(removed).toEqual([cachePath(source)]);
  });

  test("purge keeps cache when another declaration references same cache key", async () => {
    const source = "npm:@scope/plugin-demo@^1.0.0";
    const fs = createConfigFs([], { plugins: { demo: source, alias: source } });
    const removed: string[] = [];

    const result = await removePluginDeclaration("demo", {
      rootDir: "/workspace/project",
      fs,
      purge: true,
      rm: async (path) => { removed.push(path); },
      cache: { env: { XDG_CACHE_HOME: "/cache" } },
    });

    expect(result.purged).toBe(false);
    expect(result.purgeSkippedReason).toBe("still-referenced");
    expect(removed).toEqual([]);
    expect(readWrittenConfig(fs)).toEqual({ plugins: { alias: source } });
  });

  test("file source purge removes only config and never deletes local path or cache", async () => {
    const fs = createConfigFs([], { plugins: { local: "file:./plugins/local" } });
    const removed: string[] = [];

    const result = await removePluginDeclaration("local", {
      rootDir: "/workspace/project",
      fs,
      purge: true,
      rm: async (path) => { removed.push(path); },
      cache: { env: { XDG_CACHE_HOME: "/cache" } },
    });

    expect(result.purged).toBe(false);
    expect(result.purgeSkippedReason).toBe("not-cacheable");
    expect(removed).toEqual([]);
    expect(readWrittenConfig(fs)).toEqual({});
  });

  test("fails for missing plugin id without mutation", async () => {
    const fs = createConfigFs([], { plugins: { demo: "npm:plugin-demo" } });

    await expect(removePluginDeclaration("missing", { rootDir: "/workspace/project", fs })).rejects.toThrow("is not declared");
    expect(fs.written).toBeNull();
  });

  test("fails for blank id without reading config", async () => {
    const events: string[] = [];
    const fs = createConfigFs(events, { plugins: { demo: "npm:plugin-demo" } });

    await expect(removePluginDeclaration(" ", { rootDir: "/workspace/project", fs })).rejects.toThrow("Plugin id must be non-empty");
    expect(events).toEqual([]);
    expect(fs.written).toBeNull();
  });

  test("fails for missing config", async () => {
    const fs = createConfigFs([], null);

    await expect(removePluginDeclaration("demo", { rootDir: "/workspace/project", fs })).rejects.toThrow(".boxfilesrc does not exist");
    expect(fs.written).toBeNull();
  });

  test("validates existing config before mutation", async () => {
    const fs = createRawConfigFs([], JSON.stringify({ plugins: { broken: 42 } }));

    await expect(removePluginDeclaration("broken", { rootDir: "/workspace/project", fs })).rejects.toThrow("Validation failed for .boxfilesrc config");
    expect(fs.written).toBeNull();
  });
});

type TestPluginRemoveFileSystem = PluginRemoveFileSystem & {
  readonly written: string | null;
};

function createConfigFs(events: string[], initial: Readonly<Record<string, unknown>> | null): TestPluginRemoveFileSystem {
  return createRawConfigFs(events, initial === null ? null : JSON.stringify(initial));
}

function createRawConfigFs(events: string[], initial: string | null): TestPluginRemoveFileSystem {
  let written: string | null = null;
  return {
    get written() {
      return written;
    },
    async readFile(_path, _encoding) {
      events.push("read");
      if (initial !== null) return initial;
      throw enoentError();
    },
    async writeFile(_path, data) {
      events.push("write");
      written = data;
    },
  };
}

function readWrittenConfig(fs: TestPluginRemoveFileSystem): unknown {
  if (fs.written === null) throw new Error("Expected .boxfilesrc write");
  return JSON.parse(fs.written) as unknown;
}

function cachePath(source: string): string {
  const entry = getPluginCacheEntry(parsePluginSource(source), { env: { XDG_CACHE_HOME: "/cache" } });
  if (entry === null) throw new Error("Expected cache entry");
  return entry.path;
}

function enoentError(): Error {
  const error = new Error("missing") as Error & { code: string };
  error.code = "ENOENT";
  return error;
}
