import { formatCommandError } from "@boxfiles/diagnostics";
import { type ExecutionPlanDto, PlanExecutor, RuntimeRootMismatchError } from "@boxfiles/core";
import { app } from "../app";
import { gatherRuntimeContextSnapshot, getActiveRuntime } from "../runtime";
import { markdownView } from "../views/markdown";

export const applyCmd = app
  .sub("apply")
  .meta({
    description: "Apply discovered manifest actions.",
  })
  .flags({
    dryRun: {
      type: "boolean",
      default: false,
      description: "Show what would run without making changes.",
    },
    confirm: {
      type: "boolean",
      default: false,
      description: "Confirm unsafe actions before execution.",
    },
  })
  .run(async (input) => {
    try {
      await runApply(input.flags.dir, input.flags.dryRun, input.flags.confirm);
    } catch (error) {
      process.exitCode = 1;
      console.error(markdownView(formatCommandError(error)));
    }
  });

async function runApply(rootDir: string, dryRun: boolean, confirm: boolean): Promise<void> {
  const runtime = getActiveRuntime();
  if (runtime.rootDir !== rootDir) {
    throw new RuntimeRootMismatchError(rootDir, runtime.rootDir);
  }

  const facts = await gatherRuntimeContextSnapshot(runtime);
  const plan = await runtime.manifestService.plan({ facts });
  const executor = new PlanExecutor(runtime.pluginService, rootDir);

  if (dryRun) {
    console.log(markdownView(renderApplyDryRun(plan)));
    return;
  }

  const result = await executor.execute(plan, { confirmUnsafe: confirm, facts });
  if (!result.success) process.exitCode = 1;
  console.log(markdownView(renderApplyReport(result)));
}

function renderApplyDryRun(plan: ExecutionPlanDto): string {
  const lines = ["## Apply Dry Run", "", `Manifests: ${plan.manifests.length}`, `Actions: ${plan.actions.length}`, ""];

  for (const action of plan.actions) {
    lines.push(`- ${action.actionId} (${action.kind}) — ${action.summary}`);
  }

  return lines.join("\n");
}

function renderApplyReport(result: { readonly success: boolean; readonly results: readonly { readonly actionId: string; readonly success: boolean; readonly message?: string; }[]; }): string {
  const lines = ["## Apply Results", ""];
  for (const item of result.results) {
    lines.push(`- ${item.actionId}: ${item.success ? "ok" : "fail"}${item.message ? ` — ${item.message}` : ""}`);
  }
  lines.push("", result.success ? "Apply complete." : "Apply failed.");
  return lines.join("\n");
}
