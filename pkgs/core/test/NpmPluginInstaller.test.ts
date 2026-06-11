import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  installNpmPluginSource,
  parsePluginSource,
  type CommandRunner,
  type CommandRunOptions,
  type NpmPluginSource,
} from "../src/index";

type CommandCall = {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: CommandRunOptions;
};

const createdRoots: string[] = [];
const repositoryRoot = join(import.meta.dir, "..", "..", "..");
const repositoryPackageJson = join(repositoryRoot, "package.json");
const repositoryLockfile = join(repositoryRoot, "bun.lock");

afterEach(async () => {
  await Promise.all(createdRoots.map((root) => rm(root, { recursive: true, force: true })));
  createdRoots.length = 0;
});

describe("installNpmPluginSource", () => {
  test("packs npm package in an isolated temp directory and commits extracted artifact to cache", async () => {
    const context = await createInstallContext("success");
    const calls: CommandCall[] = [];
    const source = expectNpmSource(parsePluginSource("npm:@boxfiles/plugin-demo@1.2.3"));
    const runner: CommandRunner = async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === "npm") return { exitCode: 0, stdout: JSON.stringify([{ filename: "boxfiles-plugin-demo-1.2.3.tgz" }]), stderr: "" };
      await writeFile(join(options.cwd, "package", "package.json"), "{\"name\":\"@boxfiles/plugin-demo\"}\n");
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const entry = await installNpmPluginSource(source, {
      commandRunner: runner,
      env: { XDG_CACHE_HOME: context.xdgCacheHome },
      homedir: context.home,
      tempRoot: context.tempRoot,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.command).toBe("npm");
    expect(calls[0]?.args).toEqual([
      "pack",
      "@boxfiles/plugin-demo@1.2.3",
      "--pack-destination",
      join(calls[0]?.options.cwd ?? "", "pack"),
      "--ignore-scripts",
      "--json",
    ]);
    expect(calls[0]?.options.cwd.startsWith(context.tempRoot)).toBe(true);
    expect(calls[0]?.options.cwd).not.toBe(process.cwd());
    expect(calls[0]?.args.join(" ")).not.toContain(process.cwd());
    expect(calls[1]?.command).toBe("tar");
    expect(calls[1]?.options.cwd).toBe(calls[0]?.options.cwd);
    expect(entry.path).toContain(join(context.xdgCacheHome, "boxfiles", "plugins", "npm"));
    await expect(stat(join(entry.path, "package.json"))).resolves.toBeDefined();
  });

  test("does not modify project package files", async () => {
    const packageJsonBefore = await readFile(repositoryPackageJson, "utf8");
    const lockfileBefore = await readFile(repositoryLockfile, "utf8");
    const context = await createInstallContext("project-files");
    const runner: CommandRunner = async (command, _args, options) => {
      if (command === "tar") await writeFile(join(options.cwd, "package", "index.js"), "export {};\n");
      return command === "npm"
        ? { exitCode: 0, stdout: "plugin-demo-1.0.0.tgz\n", stderr: "" }
        : { exitCode: 0, stdout: "", stderr: "" };
    };

    await installNpmPluginSource({ kind: "npm", packageName: "plugin-demo", version: "1.0.0" }, {
      commandRunner: runner,
      env: { XDG_CACHE_HOME: context.xdgCacheHome },
      homedir: context.home,
      tempRoot: context.tempRoot,
    });

    await expect(readFile(repositoryPackageJson, "utf8")).resolves.toBe(packageJsonBefore);
    await expect(readFile(repositoryLockfile, "utf8")).resolves.toBe(lockfileBefore);
  });

  test("surfaces command output on npm failure and does not commit cache entry", async () => {
    const context = await createInstallContext("failure");
    const source: NpmPluginSource = { kind: "npm", packageName: "missing-plugin", version: "9.9.9" };
    const runner: CommandRunner = async () => ({
      exitCode: 1,
      stdout: "not found",
      stderr: "404 missing-plugin",
    });

    await expect(installNpmPluginSource(source, {
      commandRunner: runner,
      env: { XDG_CACHE_HOME: context.xdgCacheHome },
      homedir: context.home,
      tempRoot: context.tempRoot,
    })).rejects.toThrow(/npm pack failed with exit code 1[\s\S]*404 missing-plugin[\s\S]*not found/u);

    const cacheNpmRoot = join(context.xdgCacheHome, "boxfiles", "plugins", "npm");
    await expect(stat(cacheNpmRoot)).rejects.toThrow();
  });
});

async function createInstallContext(name: string): Promise<{
  readonly root: string;
  readonly home: string;
  readonly xdgCacheHome: string;
  readonly tempRoot: string;
}> {
  const root = join(tmpdir(), `boxfiles-npm-plugin-installer-${name}-${crypto.randomUUID()}`);
  const home = join(root, "home");
  const xdgCacheHome = join(root, "xdg-cache");
  const tempRoot = join(root, "temp");
  await mkdir(tempRoot, { recursive: true });
  createdRoots.push(root);
  return { root, home, xdgCacheHome, tempRoot };
}

function expectNpmSource(source: ReturnType<typeof parsePluginSource>): NpmPluginSource {
  if (source.kind !== "npm") throw new Error("Expected npm source");
  return source;
}
