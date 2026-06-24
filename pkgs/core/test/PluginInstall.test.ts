import { describe, expect, test } from "bun:test";
import { getPluginCacheEntry, installPluginDeclaration, parsePluginSource, type GitPluginSource, type NpmPluginSource, type PluginInstallFileSystem } from "../../plugin/src/index";

describe("installPluginDeclaration", () => {
  test("validates config and fetches npm source before writing string shorthand to .boxfilesrc", async () => {
    const events: string[] = [];
    const fs = createConfigFs(events, JSON.stringify({ settings: { plugins: { allowRemote: true } }, plugins: { old: "file:./old" } }));

    await installPluginDeclaration("demo", "npm:../../plugin/src/index-demo@1.2.3", {
      rootDir: "/workspace/project",
      fs,
      installNpm: async (source) => {
        events.push(`install:${source.kind}:${npmSpecifier(source)}`);
      },
      installGit: async () => { throw new Error("git installer should not run"); },
      resolveFile: async () => { throw new Error("file resolver should not run"); },
    });

    expect(events).toEqual(["read", "install:npm:../../plugin/src/index-demo@1.2.3", "mkdir", "write"]);
    expect(readWrittenPluginMap(fs)).toEqual({
      old: "file:./old",
      demo: "npm:../../plugin/src/index-demo@1.2.3",
    });
  });

  test("validates config and fetches git source before writing string shorthand to .boxfilesrc", async () => {
    const events: string[] = [];
    const fs = createConfigFs(events);

    await installPluginDeclaration("workstation", "git:https://example.com/org/plugin.git#v1", {
      rootDir: "/workspace/project",
      fs,
      installNpm: async () => { throw new Error("npm installer should not run"); },
      installGit: async (source) => {
        events.push(`install:${source.kind}:${gitSpecifier(source)}`);
      },
      resolveFile: async () => { throw new Error("file resolver should not run"); },
    });

    expect(events).toEqual(["read", "install:git:https://example.com/org/plugin.git#v1", "mkdir", "write"]);
    expect(readWrittenPluginMap(fs)).toEqual({ workstation: "git:https://example.com/org/plugin.git#v1" });
  });

  test("validates file source before writing and skips cache installers", async () => {
    const events: string[] = [];
    const fs = createConfigFs(events);

    await installPluginDeclaration("local", "file:./plugins/local", {
      rootDir: "/workspace/project",
      fs,
      installNpm: async () => { throw new Error("npm installer should not run"); },
      installGit: async () => { throw new Error("git installer should not run"); },
      resolveFile: async (source, options) => {
        events.push(`resolve:${source.kind}:${source.path}:${options.configPath}`);
      },
    });

    expect(events).toEqual(["read", "resolve:file:./plugins/local:/workspace/project/.boxfilesrc", "mkdir", "write"]);
    expect(readWrittenPluginMap(fs)).toEqual({ local: "file:./plugins/local" });
  });

  test("does not mutate .boxfilesrc when npm fetch fails", async () => {
    const events: string[] = [];
    const fs = createConfigFs(events);

    await expect(installPluginDeclaration("demo", "npm:plugin-demo@1.0.0", {
      rootDir: "/workspace/project",
      fs,
      installNpm: async () => {
        events.push("install:npm");
        throw new Error("npm unavailable");
      },
    })).rejects.toThrow("npm unavailable");

    expect(events).toEqual(["read", "install:npm"]);
    expect(fs.written).toBeNull();
  });


  test("does not mutate .boxfilesrc when git fetch fails", async () => {
    const events: string[] = [];
    const fs = createConfigFs(events);

    await expect(installPluginDeclaration("demo", "git:https://example.com/org/plugin.git", {
      rootDir: "/workspace/project",
      fs,
      installGit: async () => {
        events.push("install:git");
        throw new Error("git unavailable");
      },
    })).rejects.toThrow("git unavailable");

    expect(events).toEqual(["read", "install:git"]);
    expect(fs.written).toBeNull();
  });

  test("does not mutate .boxfilesrc when file validation fails", async () => {
    const events: string[] = [];
    const fs = createConfigFs(events);

    await expect(installPluginDeclaration("local", "file:./plugins/missing", {
      rootDir: "/workspace/project",
      fs,
      resolveFile: async () => {
        events.push("resolve:file");
        throw new Error("local plugin missing");
      },
    })).rejects.toThrow("local plugin missing");

    expect(events).toEqual(["read", "resolve:file"]);
    expect(fs.written).toBeNull();
  });

  test("does not mutate .boxfilesrc for invalid source", async () => {
    const events: string[] = [];
    const fs = createConfigFs(events);

    await expect(installPluginDeclaration("demo", "https://example.com/plugin", {
      rootDir: "/workspace/project",
      fs,
      installNpm: async () => { events.push("install:npm"); },
    })).rejects.toThrow("Invalid plugin source");

    expect(events).toEqual([]);
    expect(fs.written).toBeNull();
  });


  test("does not fetch or mutate when existing .boxfilesrc contains invalid JSON", async () => {
    const events: string[] = [];
    const fs = createConfigFs(events, "{");

    await expect(installPluginDeclaration("demo", "npm:plugin-demo@1.0.0", {
      rootDir: "/workspace/project",
      fs,
      installNpm: async () => { events.push("install:npm"); },
    })).rejects.toThrow("Unable to parse .boxfilesrc as JSON");

    expect(events).toEqual(["read"]);
    expect(fs.written).toBeNull();
  });

  test("does not fetch or mutate when existing .boxfilesrc config is invalid", async () => {
    const events: string[] = [];
    const fs = createConfigFs(events, JSON.stringify({ plugins: { broken: 42 } }));

    await expect(installPluginDeclaration("demo", "git:https://example.com/org/plugin.git", {
      rootDir: "/workspace/project",
      fs,
      installGit: async () => { events.push("install:git"); },
    })).rejects.toThrow("Validation failed for .boxfilesrc config");

    expect(events).toEqual(["read"]);
    expect(fs.written).toBeNull();
  });

  test("reports cache path and repair instruction when config update fails after cache population", async () => {
    const events: string[] = [];
    const fs = createFailingWriteConfigFs(events);
    const source = "npm:plugin-demo@1.0.0";
    const cache = { env: { XDG_CACHE_HOME: "/workspace/custom-cache" } };
    const cacheEntry = getPluginCacheEntry(parsePluginSource(source), cache);
    if (cacheEntry === null) throw new Error("Expected cache entry");

    await expect(installPluginDeclaration("demo", source, {
      rootDir: "/workspace/project",
      fs,
      cache,
      installNpm: async () => { events.push("install:npm"); },
    })).rejects.toThrow(new RegExp(`Failed to update \\.boxfilesrc.*${escapeRegExp(cacheEntry.path)}.*Repair by removing that cache directory`, "u"));

    expect(events).toEqual(["read", "install:npm", "mkdir", "write"]);
    expect(fs.written).toBeNull();
  });
});

type TestPluginInstallFileSystem = PluginInstallFileSystem & {
  readonly written: string | null;
};

function createConfigFs(events: string[], initial: string | null = null): TestPluginInstallFileSystem {
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
    async mkdir(_path, _options) {
      events.push("mkdir");
    },
  };
}

function createFailingWriteConfigFs(events: string[]): TestPluginInstallFileSystem {
  return {
    get written() {
      return null;
    },
    async readFile(_path, _encoding) {
      events.push("read");
      throw enoentError();
    },
    async writeFile(_path, _data) {
      events.push("write");
      throw new Error("disk full");
    },
    async mkdir(_path, _options) {
      events.push("mkdir");
    },
  };
}

function readWrittenPluginMap(fs: TestPluginInstallFileSystem): Readonly<Record<string, string>> {
  if (fs.written === null) throw new Error("Expected .boxfilesrc write");
  const parsed = JSON.parse(fs.written) as unknown;
  if (!isRecord(parsed) || !isStringMap(parsed["plugins"])) throw new Error("Expected plugin map");
  return parsed["plugins"];
}

function npmSpecifier(source: NpmPluginSource): string {
  return source.version === undefined ? source.packageName : `${source.packageName}@${source.version}`;
}

function gitSpecifier(source: GitPluginSource): string {
  return source.ref === undefined ? source.url : `${source.url}#${source.ref}`;
}

function enoentError(): Error {
  const error = new Error("missing") as Error & { code: string };
  error.code = "ENOENT";
  return error;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringMap(value: unknown): value is Readonly<Record<string, string>> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
