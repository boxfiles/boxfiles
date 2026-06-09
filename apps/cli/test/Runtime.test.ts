import { Crust } from "@crustjs/core";
import { describe, expect, test } from "bun:test";
import {
  boxfilesRuntimePlugin,
  clearActiveRuntime,
  createCliRuntime,
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
    expect(runtime.pluginService.rootDir).toBe(rootDir);
    expect(runtime.manifestService.rootDir).toBe(rootDir);
    expect(runtime.pluginService.getActionProvider("copy")?.kind).toBe("copy");
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

  test("active runtime can be cleared without an active value", () => {
    clearActiveRuntime();

    expect(() => getActiveRuntime()).toThrow("Boxfiles runtime is not active");
  });
});
