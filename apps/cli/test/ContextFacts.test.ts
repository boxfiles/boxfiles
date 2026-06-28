import { Crust } from "@crustjs/core";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contextCmd, sortFacts } from "../src/cmds/context";
import { boxfilesRuntimePlugin } from "../src/runtime";

const createdRoots: string[] = [];
const initialProcessExitCode = process.exitCode;

afterEach(async () => {
  await Promise.all(createdRoots.map((root) => rm(root, { recursive: true, force: true })));
  createdRoots.length = 0;
  restoreProcessExitCode(initialProcessExitCode);
});

describe("context facts CLI", () => {
  test.serial("emits a JSON object of gathered context facts", async () => {
    const root = await createRoot("json-shape");

    const output = await runContextCli(["context", "facts", "--json", "--dir", root]);
    const facts = parseJsonObject(output.stdout);

    expect(output.exitCode).toBe(0);
    expect(typeof facts["os.platform"]).toBe("string");
  });

  test.serial("filters JSON facts by prefix without nesting keys", async () => {
    const root = await createRoot("prefix");
    await createLocalContextPlugin(root);

    const output = await runContextCli(["context", "facts", "--json", "--prefix", "test.", "--dir", root]);
    const facts = parseJsonObject(output.stdout);

    expect(facts).toEqual({
      "test.alpha": "first",
      "test.middle": 2,
      "test.zulu": true,
    });
  });

  test("sorts fact keys lexicographically", () => {
    const sorted = sortFacts({
      "test.zulu": true,
      "test.alpha": "first",
      "test.middle": 2,
    });

    expect(Object.keys(sorted)).toEqual(["test.alpha", "test.middle", "test.zulu"]);
  });

  test.serial("no-match JSON prefix succeeds with an empty object", async () => {
    const root = await createRoot("no-match-json");

    const output = await runContextCli(["context", "facts", "--json", "--prefix", "missing.", "--dir", root]);

    expect(output.exitCode).toBe(0);
    expect(parseJsonObject(output.stdout)).toEqual({});
  });

  test.serial("no-match Markdown reports no facts found", async () => {
    const root = await createRoot("no-match-markdown");

    const output = await runContextCli(["context", "facts", "--prefix", "missing.", "--dir", root]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("No facts found for prefix");
    expect(output.stdout).toContain("missing.");
});
});

type CliOutput = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

async function runContextCli(argv: readonly string[]): Promise<CliOutput> {
  const app = new Crust("boxfiles")
    .flags({
      dir: {
        type: "path",
        inherit: true,
        default: process.cwd(),
      },
    })
    .use(boxfilesRuntimePlugin())
    .command(contextCmd);

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

function parseJsonObject(text: string): Readonly<Record<string, unknown>> {
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) throw new Error("Expected JSON object output");
  return parsed;
}

function restoreProcessExitCode(value: typeof process.exitCode): void {
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
  const root = join(tmpdir(), `boxfiles-cli-context-${name}-${crypto.randomUUID()}`);
  await mkdir(root, { recursive: true });
  createdRoots.push(root);
  return root;
}

async function createLocalContextPlugin(root: string): Promise<void> {
  const pluginRoot = join(root, "plugins", "context");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(join(root, ".boxfilesrc"), `${JSON.stringify({ plugins: { context: "file:./plugins/context" } })}\n`);
  await writeFile(join(pluginRoot, "package.json"), JSON.stringify({ main: "./index.js" }));
  await writeFile(join(pluginRoot, "index.js"), `
export default {
  id: "context-test",
  context: {
    "test.zulu": true,
    "test.alpha": "first",
    "test.middle": 2
  }
};
`);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
