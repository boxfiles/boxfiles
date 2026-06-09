import * as path from "node:path";
import { RuntimeRootMismatchError } from "../exceptions/runtime";
import { app } from "../app";
import { formatCommandError } from "../common/console";
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
        await listManifestFiles(input.flags.dir);
      }),
  )
  .command("plan", (cmd) =>
    cmd
      .meta({
        description: "Show planned manifest list.",
      })
      .run(async (input) => {
        await listManifestPlan(input.flags.dir);
      }),
  );

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

  try {
    const plan = await runtime.manifestService.plan({ facts: {} });

    if (plan.manifests.length === 0) {
      console.log("No manifests found.");
      return;
    }

    console.log(markdownView(renderManifestPlan(plan)));
  } catch (error) {
    console.error(markdownView(formatCommandError(error)));
  }
}

function assertRuntimeRoot(rootDir: string): void {
  const runtime = getActiveRuntime();
  if (runtime.rootDir === rootDir) return;
  throw new RuntimeRootMismatchError(rootDir, runtime.rootDir);
}

function renderManifestPlan(plan: ExecutionPlanDto): string {
  const header = "## Manifest Plan\n";

  const list = plan.manifests.flatMap((manifest, index) => [
    `### ${index + 1}. ${manifest.id}`,
    `- path: \`${manifest.path}\``,
    `- files: \`${manifest.manifest.filesDir}\``,
    ...renderList("- dependencies", manifest.dependsOn, (dep) => dep),
    `- steps: ${manifest.steps.length}`,
    "",
  ]);

  return [header, ...list].join("\n");
}

function renderList<T>(
  label: string,
  items: T[],
  render: (item: T) => string,
): string[] {
  if (items.length === 0) return [`- ${label}: 0`];

  const output = [
    `${label}: ${items.length}`,
    ...items.map((item) => `  - ${render(item)}`),
  ];

  return output;
}

function stringifyConfig(config: unknown): string {
  const serialized = JSON.stringify(config);
  if (serialized === undefined) return "{}";
  return serialized;
}
