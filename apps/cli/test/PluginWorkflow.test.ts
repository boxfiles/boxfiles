import { Crust } from "@crustjs/core";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pluginCmd } from "../src/cmds/plugin";

const createdRoots: string[] = [];
const initialProcessExitCode = process.exitCode;

afterEach(async () => {
  await Promise.all(createdRoots.map((root) => rm(root, { recursive: true, force: true })));
  createdRoots.length = 0;
  restoreProcessExitCode(initialProcessExitCode);
});

describe("plugin CLI workflow", () => {
  test.serial("invalid install source fails before .boxfilesrc mutation", async () => {
    const root = await createRoot("invalid-source");
    await writeConfig(root, { plugins: { existing: "file:./plugins/existing" } });

    const output = await runPluginCli(["plugin", "install", "demo", "https://example.com/plugin", "--dir", root]);

    expect(output.exitCode).toBe(1);
    expect(output.stderr).toContain("Invalid plugin source");
    expect(await readConfig(root)).toEqual({ plugins: { existing: "file:./plugins/existing" } });
  });

  test.serial("file install updates .boxfilesrc without populating XDG plugin cache", async () => {
    const root = await createRoot("file-install");
    const xdgCacheHome = join(root, "xdg-cache");
    await createLocalPlugin(root, "local");

    const output = await withXdgCacheHome(xdgCacheHome, async () => runPluginCli([
      "plugin",
      "install",
      "local",
      "file:./plugins/local",
      "--dir",
      root,
    ]));

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("Installed plugin");
    expect(await readConfig(root)).toEqual({ plugins: { local: "file:./plugins/local" } });
    await expect(stat(join(xdgCacheHome, "boxfiles", "plugins"))).rejects.toThrow();
  });

  test.serial("remove keeps cache by default at CLI boundary", async () => {
    const root = await createRoot("remove-keeps-cache");
    await writeConfig(root, { plugins: { demo: "npm:plugin-demo@1.0.0" } });

    const output = await runPluginCli(["plugin", "remove", "demo", "--dir", root]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("Cache was kept");
    expect(await readConfig(root)).toEqual({});
  });

  test.serial("remove purge respects remaining cache references at CLI boundary", async () => {
    const root = await createRoot("remove-purge-reference");
    const source = "npm:plugin-demo@1.0.0";
    await writeConfig(root, { plugins: { demo: source, alias: source } });

    const output = await runPluginCli(["plugin", "remove", "demo", "--purge", "--dir", root]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("kept cache because another declaration");
    expect(output.stdout).toContain("still references it");
    expect(await readConfig(root)).toEqual({ plugins: { alias: source } });
  });

});

type CliOutput = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

async function runPluginCli(argv: readonly string[]): Promise<CliOutput> {
  const app = new Crust("boxfiles")
    .flags({
      dir: {
        type: "path",
        inherit: true,
        default: process.cwd(),
      },
    })
    .command(pluginCmd);

  return await captureConsole(async () => {
    await app.execute({ argv: [...argv] });
  });
}

async function captureConsole(callback: () => Promise<void>): Promise<CliOutput> {
  const originalLog = console.log;
  const originalError = console.error;
  const originalExitCode = process.exitCode;
  const stdout: string[] = [];
  const stderr: string[] = [];
  process.exitCode = 0;
  console.log = (...values: readonly unknown[]) => {
    stdout.push(values.map(String).join(" "));
  };
  console.error = (...values: readonly unknown[]) => {
    stderr.push(values.map(String).join(" "));
  };

  try {
    await callback();
    return {
      exitCode: normalizeExitCode(process.exitCode),
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n"),
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
    restoreProcessExitCode(originalExitCode);
  }
}

function restoreProcessExitCode(value: typeof process.exitCode): void {
  // Bun ignores assigning undefined to process.exitCode once it has been set, so
  // normalize the unset state to the successful process status for test cleanup.
  process.exitCode = value ?? 0;
}

function normalizeExitCode(value: typeof process.exitCode): number {
  if (value === undefined) return 0;
  if (value === null) return 0;
  if (typeof value === "number") return value;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function createRoot(name: string): Promise<string> {
  const root = join(tmpdir(), `boxfiles-cli-plugin-${name}-${crypto.randomUUID()}`);
  await mkdir(root, { recursive: true });
  createdRoots.push(root);
  return root;
}

async function createLocalPlugin(root: string, name: string): Promise<void> {
  const pluginRoot = join(root, "plugins", name);
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(join(pluginRoot, "index.ts"), "export default { id: 'local' };\n");
  await writeFile(join(pluginRoot, "package.json"), JSON.stringify({ main: "./index.ts" }));
}

async function writeConfig(root: string, config: Readonly<Record<string, unknown>>): Promise<void> {
  await writeFile(join(root, ".boxfilesrc"), `${JSON.stringify(config)}\n`);
}

async function readConfig(root: string): Promise<unknown> {
  const text = await readFile(join(root, ".boxfilesrc"), "utf8");
  return JSON.parse(text) as unknown;
}

async function withXdgCacheHome<T>(value: string, callback: () => Promise<T>): Promise<T> {
  const original = process.env.XDG_CACHE_HOME;
  process.env.XDG_CACHE_HOME = value;
  try {
    return await callback();
  } finally {
    if (original === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = original;
    }
  }
}
