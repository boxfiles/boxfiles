import { describe, expect, test } from "bun:test";
import { PlanExecutor, type ExecutionPlanDto, type ManifestId, type ActionKind, type ActionProviderRegistry, type StepId } from "@boxfiles/core";

describe("PlanExecutor", () => {
  test("stops on first failure", async () => {
    const calls: string[] = [];
    const registry: ActionProviderRegistry = {
      getActionProvider(kind) {
        if (kind === "ok") {
          return {
            kind,
            schema: {},
            validate: (config) => ({ success: true, value: config }),
            async plan() {
              throw new Error("unused");
            },
            async apply() {
              calls.push("ok");
              return { actionId: "m.1", success: true };
            },
          };
        }

        return {
          kind,
          schema: {},
          validate: (config) => ({ success: true, value: config }),
          async plan() {
            throw new Error("unused");
          },
          async apply() {
            calls.push("fail");
            return { actionId: "m.2", success: false, message: "boom" };
          },
        };
      },
    };

    const executor = new PlanExecutor(registry, "/work");
    const result = await executor.execute(createPlan(), { confirmUnsafe: true });

    expect(calls).toEqual(["ok", "fail"]);
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(2);
  });
});

function createPlan(): ExecutionPlanDto {
  return {
    manifests: [
      {
        id: "m" as ManifestId,
        path: "m.toml",
        manifest: { id: "m" as ManifestId, path: "m.toml", dir: ".", filesDir: "files" },
        dependsOn: [],
        steps: [
          { id: "m.1" as StepId, manifestId: "m" as ManifestId, uses: "ok" as ActionKind, config: {} },
          { id: "m.2" as StepId, manifestId: "m" as ManifestId, uses: "fail" as ActionKind, config: {} },
        ],
      },
    ],
    actions: [
      { actionId: "m.1" as StepId, manifestId: "m" as ManifestId, kind: "ok" as ActionKind, summary: "ok", safety: { idempotent: true, unsafe: false }, changes: [] },
      { actionId: "m.2" as StepId, manifestId: "m" as ManifestId, kind: "fail" as ActionKind, summary: "fail", safety: { idempotent: false, unsafe: true }, changes: [] },
    ],
  };
}
