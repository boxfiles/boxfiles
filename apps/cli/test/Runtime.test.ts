import { Crust } from "@crustjs/core";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  boxfilesRuntimePlugin,
  clearActiveRuntime,
  createCliRuntime,
  createConfiguredCliRuntime,
  getActiveRuntime,
  type CliRuntime,
} from "../src/runtime";

let rootCounter = 0;
function createRoot(): string {
  rootCounter += 1;
  return `/boxfiles-runtime-${rootCounter}`;
}

describe("createCliRuntime", () => {
  test("registers built-in plugins once for one runtime", async () => {
    const rootDir = createRoot();
    const runtime = createCliRuntime(rootDir);

    expect(runtime.rootDir).toBe(rootDir);
    expect(runtime.manifestService.rootDir).toBe(rootDir);
    expect(runtime.pluginService.getActionProvider("copy")?.kind).toBe("copy");
  });


  test("loads installed local plugins after built-ins", async () => {
    const rootDir = await createLocalPluginRoot();
    const runtime = await createConfiguredCliRuntime(rootDir);

    expect(runtime.pluginService.getActionProvider("copy")?.kind).toBe("copy");
    expect(runtime.pluginService.getActionProvider("runtime.local")?.kind).toBe("runtime.local");
  });
});

describe("boxfilesRuntimePlugin", () => {
  test("sets active runtime during command execution and clears it after", async () => {
    const rootDir = createRoot();
    const seen: { runtime?: CliRuntime } = {};

    const app = new Crust("runtime-test")
      .flags({
        dir: {
          type: "path",
          inherit: true,
          default: rootDir,
        },
      })
      .use(boxfilesRuntimePlugin())
      .run(() => {
        seen.runtime = getActiveRuntime();
      });

    await app.execute({ argv: ["--dir", rootDir] });

    expect(seen.runtime?.rootDir).toBe(rootDir);
    expect(() => getActiveRuntime()).toThrow("Boxfiles runtime is not active");
  });


  test("plugin management commands use a base runtime when installed plugin cache is broken", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "boxfiles-runtime-missing-cache-"));
    const missingSource = `npm:boxfiles-plugin-runtime-missing-${Date.now()}@1.0.0`;
    await writeFile(join(rootDir, ".boxfilesrc"), `${JSON.stringify({ plugins: { missing: missingSource } })}\n`);

    const commandsRun: string[] = [];
    const app = new Crust("runtime-test")
      .flags({
        dir: {
          type: "path",
          inherit: true,
          default: rootDir,
        },
      })
      .use(boxfilesRuntimePlugin())
      .command("plugin", (plugin) => plugin
        .command("install", (cmd) => cmd.run(() => {
          commandsRun.push("install");
          expect(getActiveRuntime().pluginService.getActionProvider("copy")?.kind).toBe("copy");
          expect(getActiveRuntime().pluginService.listPlugins().map((pluginSummary) => pluginSummary.id)).toContain("copy");
        }))
        .command("remove", (cmd) => cmd.run(() => {
          commandsRun.push("remove");
          expect(getActiveRuntime().pluginService.getActionProvider("copy")?.kind).toBe("copy");
          expect(getActiveRuntime().pluginService.listPlugins().map((pluginSummary) => pluginSummary.source)).toEqual(
            expect.arrayContaining(["builtin"]),
          );
        })));

    await app.execute({ argv: ["plugin", "install", "--dir", rootDir] });
    await app.execute({ argv: ["plugin", "remove", "--dir", rootDir] });

    expect(commandsRun).toEqual(["install", "remove"]);
    expect(() => getActiveRuntime()).toThrow("Boxfiles runtime is not active");
  });

  test("active runtime can be cleared without an active value", () => {
    clearActiveRuntime();

    expect(() => getActiveRuntime()).toThrow("Boxfiles runtime is not active");
  });
});

async function createLocalPluginRoot(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), "boxfiles-runtime-local-"));
  const pluginDir = join(rootDir, "plugins", "local");

  await mkdir(pluginDir, { recursive: true });
  await writeFile(join(rootDir, ".boxfilesrc"), `${JSON.stringify({ plugins: { local: "file:./plugins/local" } })}\n`);
  await writeFile(join(pluginDir, "index.js"), `
export default {
  id: "runtime-local-plugin",
  actions: {
    local: {
      kind: "runtime.local",
      schema: {},
      validate(config) { return { success: true, value: config }; },
      async plan(input) {
        return {
          actionId: input.action.id,
          manifestId: input.action.manifestId,
          kind: input.action.uses,
          summary: "runtime local",
          safety: { idempotent: true, unsafe: false },
          changes: [],
        };
      },
      async apply(input) { return { actionId: input.action.id, success: true }; },
    },
  },
};
`);

  return rootDir;
}
