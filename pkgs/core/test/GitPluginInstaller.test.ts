import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  getPluginCacheEntry,
  installGitPluginSource,
  parsePluginSource,
  type GitCommandRunOptions,
  type GitCommandRunner,
  type GitPluginInstallerFileSystem,
  type GitPluginSource,
} from "../../plugin/src/index";

type CommandCall = {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: GitCommandRunOptions;
};

const createdRoots: string[] = [];
const repositoryRoot = join(import.meta.dir, "..", "..", "..");
const repositoryPackageJson = join(repositoryRoot, "package.json");
const repositoryLockfile = join(repositoryRoot, "bun.lock");

afterEach(async () => {
  await Promise.all(createdRoots.map((root) => rm(root, { recursive: true, force: true })));
  createdRoots.length = 0;
});

describe("installGitPluginSource", () => {
  test("clones git URL into a temp directory and commits cloned artifact to cache", async () => {
    const context = await createInstallContext("success");
    const calls: CommandCall[] = [];
    const source = expectGitSource(parsePluginSource("git:https://example.com/boxfiles/provider-copy.git"));
    const runner: GitCommandRunner = async (command, args, options) => {
      calls.push({ command, args, options });
      if (args[0] === "clone") {
        const cloneDirectory = expectString(args.at(-1));
        await mkdir(cloneDirectory, { recursive: true });
        await writeFile(join(cloneDirectory, "package.json"), "{\"name\":\"provider-copy\"}\n");
      }
      return args[0] === "rev-parse"
        ? { exitCode: 0, stdout: "abc123def456\n", stderr: "" }
        : { exitCode: 0, stdout: "", stderr: "" };
    };

    const result = await installGitPluginSource(source, {
      commandRunner: runner,
      env: { XDG_CACHE_HOME: context.xdgCacheHome },
      homedir: context.home,
      tempRoot: context.tempRoot,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.command).toBe("git");
    expect(calls[0]?.args).toEqual([
      "clone",
      "--depth",
      "1",
      "https://example.com/boxfiles/provider-copy.git",
      join(calls[0]?.options.cwd ?? "", "clone"),
    ]);
    expect(calls[0]?.options.cwd.startsWith(context.tempRoot)).toBe(true);
    expect(calls[0]?.options.cwd).not.toBe(process.cwd());
    expect(calls[1]?.args).toEqual(["rev-parse", "HEAD"]);
    expect(calls[1]?.options.cwd).toBe(join(calls[0]?.options.cwd ?? "", "clone"));
    expect(result.cacheEntry.path).toContain(join(context.xdgCacheHome, "boxfiles", "plugins", "git"));
    expect(result.metadata).toEqual({ requestedUrl: source.url, resolvedCommit: "abc123def456" });
    await expect(stat(join(result.cacheEntry.path, "package.json"))).resolves.toBeDefined();
    const metadata = await readFile(join(result.cacheEntry.path, ".boxfiles-plugin-source.json"), "utf8");
    expect(metadata).toContain("abc123def456");
  });

  test("checks out optional ref after cloning and records requested ref", async () => {
    const context = await createInstallContext("ref");
    const calls: CommandCall[] = [];
    const source: GitPluginSource = { kind: "git", url: "git@github.com:boxfiles/provider-copy.git", ref: "abc123def456" };
    const runner = createSuccessfulGitRunner(calls);

    const result = await installGitPluginSource(source, {
      commandRunner: runner,
      env: { XDG_CACHE_HOME: context.xdgCacheHome },
      homedir: context.home,
      tempRoot: context.tempRoot,
    });

    expect(calls[0]?.args).toEqual([
      "clone",
      "--no-checkout",
      "git@github.com:boxfiles/provider-copy.git",
      join(calls[0]?.options.cwd ?? "", "clone"),
    ]);
    expect(calls[0]?.args).not.toContain("--branch");
    expect(calls[1]?.args).toEqual(["checkout", "--detach", "abc123def456"]);
    expect(calls[1]?.options.cwd).toBe(join(calls[0]?.options.cwd ?? "", "clone"));
    expect(calls[2]?.args).toEqual(["rev-parse", "HEAD"]);
    expect(result.metadata).toEqual({
      requestedUrl: "git@github.com:boxfiles/provider-copy.git",
      requestedRef: "abc123def456",
      resolvedCommit: "abc123def456",
    });
  });

  test("treats GitHub HTTPS as an ordinary git URL", async () => {
    const context = await createInstallContext("github");
    const calls: CommandCall[] = [];
    const source = expectGitSource(parsePluginSource("git:https://github.com/boxfiles/provider-copy.git#main"));
    const runner = createSuccessfulGitRunner(calls);

    await installGitPluginSource(source, {
      commandRunner: runner,
      env: { XDG_CACHE_HOME: context.xdgCacheHome },
      homedir: context.home,
      tempRoot: context.tempRoot,
    });

    expect(calls[0]?.args).toContain("https://github.com/boxfiles/provider-copy.git");
    expect(calls[0]?.args).not.toContain("github:");
    expect(calls[1]?.args).toEqual(["checkout", "--detach", "main"]);
  });

  test("surfaces command output on git failure and does not commit cache entry", async () => {
    const context = await createInstallContext("failure");
    const source: GitPluginSource = { kind: "git", url: "https://example.com/missing/plugin.git", ref: "main" };
    const runner: GitCommandRunner = async () => ({
      exitCode: 128,
      stdout: "remote rejected",
      stderr: "fatal: repository not found",
    });

    await expect(installGitPluginSource(source, {
      commandRunner: runner,
      env: { XDG_CACHE_HOME: context.xdgCacheHome },
      homedir: context.home,
      tempRoot: context.tempRoot,
    })).rejects.toThrow(/git clone failed with exit code 128[\s\S]*fatal: repository not found[\s\S]*remote rejected/u);

    const cacheGitRoot = join(context.xdgCacheHome, "boxfiles", "plugins", "git");
    await expect(stat(cacheGitRoot)).rejects.toThrow();
  });

  test("preserves existing cache entry when commit fails", async () => {
    const context = await createInstallContext("commit-failure");
    const calls: CommandCall[] = [];
    const source: GitPluginSource = { kind: "git", url: "https://example.com/boxfiles/provider-copy.git" };
    const cacheEntry = getPluginCacheEntry(source, { env: { XDG_CACHE_HOME: context.xdgCacheHome }, homedir: context.home });
    if (cacheEntry === null) throw new Error("Expected cache entry");
    await mkdir(cacheEntry.path, { recursive: true });
    await writeFile(join(cacheEntry.path, "existing.txt"), "keep me\n");

    const fs = createCommitFailureFileSystem(cacheEntry.path);

    await expect(installGitPluginSource(source, {
      commandRunner: createSuccessfulGitRunner(calls),
      env: { XDG_CACHE_HOME: context.xdgCacheHome },
      fs,
      homedir: context.home,
      tempRoot: context.tempRoot,
    })).rejects.toThrow(/commit boom/u);

    await expect(readFile(join(cacheEntry.path, "existing.txt"), "utf8")).resolves.toBe("keep me\n");
    await expect(stat(join(cacheEntry.path, ".boxfiles-plugin-source.json"))).rejects.toThrow();
  });

  test("does not modify project package files", async () => {
    const packageJsonBefore = await readFile(repositoryPackageJson, "utf8");
    const lockfileBefore = await readFile(repositoryLockfile, "utf8");
    const context = await createInstallContext("project-files");
    const calls: CommandCall[] = [];
    const runner = createSuccessfulGitRunner(calls);

    await installGitPluginSource({ kind: "git", url: "https://example.com/boxfiles/provider-copy.git" }, {
      commandRunner: runner,
      env: { XDG_CACHE_HOME: context.xdgCacheHome },
      homedir: context.home,
      tempRoot: context.tempRoot,
    });

    await expect(readFile(repositoryPackageJson, "utf8")).resolves.toBe(packageJsonBefore);
    await expect(readFile(repositoryLockfile, "utf8")).resolves.toBe(lockfileBefore);
  });
});

async function createInstallContext(name: string): Promise<{
  readonly root: string;
  readonly home: string;
  readonly xdgCacheHome: string;
  readonly tempRoot: string;
}> {
  const root = join(tmpdir(), `boxfiles-git-plugin-installer-${name}-${crypto.randomUUID()}`);
  const home = join(root, "home");
  const xdgCacheHome = join(root, "xdg-cache");
  const tempRoot = join(root, "temp");
  await mkdir(tempRoot, { recursive: true });
  createdRoots.push(root);
  return { root, home, xdgCacheHome, tempRoot };
}

function createSuccessfulGitRunner(calls: CommandCall[]): GitCommandRunner {
  return async (command, args, options) => {
    calls.push({ command, args, options });
    if (args[0] === "clone") {
      const cloneDirectory = expectString(args.at(-1));
      await mkdir(cloneDirectory, { recursive: true });
      await writeFile(join(cloneDirectory, "index.ts"), "export {};\n");
    }
    return args[0] === "rev-parse"
      ? { exitCode: 0, stdout: "abc123def456\n", stderr: "" }
      : { exitCode: 0, stdout: "", stderr: "" };
  };
}

function createCommitFailureFileSystem(committedPath: string): GitPluginInstallerFileSystem {
  return {
    mkdir: async (path, options) => { void await mkdir(path, options); },
    mkdtemp,
    rename: async (from, to) => {
      if (basename(from) === "clone" && to === committedPath) {
        throw new Error("commit boom");
      }
      await rename(from, to);
    },
    rm,
    cp,
    writeFile,
  };
}

function expectGitSource(source: ReturnType<typeof parsePluginSource>): GitPluginSource {
  if (source.kind !== "git") throw new Error("Expected git source");
  return source;
}

function expectString(value: string | undefined): string {
  if (value === undefined) throw new Error("Expected string");
  return value;
}
