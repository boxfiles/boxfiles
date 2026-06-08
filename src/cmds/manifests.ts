import * as path from "node:path";
import { app } from "../app";
import { getActiveRuntime } from "../runtime";
import { manifestIdFromPath } from "../services/Manifest";
import type { ExecutionPlanDto } from "../services/Plan";
import { markdownView } from "../views/markdown";

export const manifestCmd = app
  .sub("manifests")
  .meta({
    description: "Inspect discovered boxfile manifests.",
  })
  .command("files", (cmd) =>
    cmd
      .meta({
        description: "List discovered boxfile manifest files.",
      })
      .run(async (input) => {
        await runManifestCommand(async () => {
          await listManifestFiles(input.flags.dir);
        });
      }),
  )
  .command("plan", (cmd) =>
    cmd
      .meta({
        description: "Show planned manifest list.",
      })
      .run(async (input) => {
        await runManifestCommand(async () => {
          await listManifestPlan(input.flags.dir);
        });
      }),
  );

async function runManifestCommand(command: () => Promise<void>): Promise<void> {
  try {
    await command();
  } catch (error) {
    process.exitCode = 1;
    console.error(formatCommandError(error));
  }
}

function formatCommandError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function listManifestFiles(rootDir: string): Promise<void> {
  const runtime = getActiveRuntime();
  assertRuntimeRoot(rootDir);
  const manifestPaths = await runtime.manifestService.discover();

  const rows = manifestPaths.map((manifestPath) => {
    const relativePath = path.relative(rootDir, manifestPath);
    const id = manifestIdFromPath(rootDir, manifestPath);

    return {
      id,
      path: relativePath,
    };
  });

  if (rows.length === 0) {
    console.log("No manifests found.");
    return;
  }

  console.log(
    markdownView(
      [
        "## Discovered Manifests\n",
        ...rows.map((row) => `- [${row.id}](${row.path})`),
      ].join("\n"),
    ),
  );
}

async function listManifestPlan(rootDir: string): Promise<void> {
  const runtime = getActiveRuntime();
  assertRuntimeRoot(rootDir);
  const plan = await runtime.manifestService.plan({ facts: {} });

  if (plan.manifests.length === 0) {
    console.log("No manifests found.");
    return;
  }

  console.log(markdownView(renderManifestPlan(plan)));
}

function assertRuntimeRoot(rootDir: string): void {
  const runtime = getActiveRuntime();
  if (runtime.rootDir === rootDir) return;
  throw new Error(`Runtime root mismatch: expected ${rootDir}, got ${runtime.rootDir}`);
}

function renderManifestPlan(plan: ExecutionPlanDto): string {
  return [
    "## Manifest Plan\n",
    ...plan.manifests.flatMap((manifest, index) => [
      `### ${index + 1}. ${manifest.id}`,
      `- path: ${manifest.path}`,
      `- files: ${manifest.manifest.filesDir}`,
      `- dependsOn: ${formatList(manifest.dependsOn)}`,
      `- steps: ${manifest.steps.length}`,
      ...manifest.steps.map(
        (step) =>
          `  - ${step.id}: ${step.uses} ${stringifyConfig(step.config)}`,
      ),
      "",
    ]),
  ].join("\n");
}

function formatList(values: readonly string[]): string {
  if (values.length === 0) return "none";
  return values.join(", ");
}

function stringifyConfig(config: unknown): string {
  const serialized = JSON.stringify(config);
  if (serialized === undefined) return "{}";
  return serialized;
}

