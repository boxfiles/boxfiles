import * as path from "node:path";
import { RuntimeRootMismatchError } from "../exceptions/runtime";
import { app } from "../app";
import { formatCommandError } from "../common/console";
import { getActiveRuntime } from "../runtime";
import { Manifest } from "../services/Manifest";
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
  .command("validate", (cmd) =>
    cmd
      .meta({
        description: "Validate discovered manifests and show all validation errors.",
      })
      .run(async (input) => {
        try {
          await validateManifestFiles(input.flags.dir);
        } catch (error) {
          process.exitCode = 1;
          console.error(markdownView(formatCommandError(error)));
        }
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

async function validateManifestFiles(rootDir: string): Promise<void> {
  const runtime = getActiveRuntime();
  assertRuntimeRoot(rootDir);

  const manifestPaths = await runtime.manifestService.discover();
  if (manifestPaths.length === 0) {
    console.log("No manifests found.");
    return;
  }

  const issues = await Promise.all(
    manifestPaths.map(async (manifestPath) => {
      try {
        const manifest = await Manifest.load(rootDir, manifestPath);
        manifest.parse();
        return null;
      } catch (error) {
        return {
          error,
          path: manifestPath,
        };
      }
    }),
  );

  const validationIssues = issues.filter(
    (issue): issue is ManifestValidationIssue => issue !== null,
  );

  if (validationIssues.length === 0) {
    console.log(markdownView("## Manifest Validation\n\nAll manifests valid."));
    return;
  }

  process.exitCode = 1;
  console.error(markdownView(renderManifestValidationReport(rootDir, validationIssues)));
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
    process.exitCode = 1;
    console.error(markdownView(formatCommandError(error)));
  }
}

function assertRuntimeRoot(rootDir: string): void {
  const runtime = getActiveRuntime();
  if (runtime.rootDir === rootDir) return;
  throw new RuntimeRootMismatchError(rootDir, runtime.rootDir);
}

function renderManifestValidationReport(
  rootDir: string,
  issues: readonly ManifestValidationIssue[],
): string {
  const lines = ["## Manifest Validation Errors", ""];

  for (const [index, issue] of issues.entries()) {
    const relativePath = path.relative(rootDir, issue.path);
    lines.push(`### ${index + 1}. \`${relativePath}\``);
    lines.push("");
    lines.push(indentBlock(formatCommandError(issue.error), "  "));
    if (index < issues.length - 1) {
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}

function indentBlock(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
    .join("\n");
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

type ManifestValidationIssue = {
  readonly error: unknown;
  readonly path: string;
};
