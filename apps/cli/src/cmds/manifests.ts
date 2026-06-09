import * as path from "node:path";
import { app } from "../app";
import { getActiveRuntime } from "../runtime";
import { formatCommandError } from "../common/console";
import { markdownView } from "../views/markdown";
import {
  Manifest as ManifestFile,
  RuntimeRootMismatchError,
  buildManifestPlanTree,
  type ExecutionPlanDto,
  type ManifestContextDto,
} from "@boxfiles/core";

type Manifest = ManifestContextDto;

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
        description:
          "Validate discovered manifests and show all validation errors.",
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
  const rows = (await runtime.manifestService.discoverContexts()).map(
    (manifest) => ({
      manifest,
    }),
  );

  if (rows.length === 0) {
    console.log("No manifests found.");
    return;
  }

  console.log(
    markdownView(
      [
        "## Discovered Manifests",
        "",
        renderManifestList(
          rows,
          (row) => `[${row.manifest.id}](${row.manifest.path})`,
        ),
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
        const manifest = await ManifestFile.load(rootDir, manifestPath);
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
  console.error(
    markdownView(renderManifestValidationReport(rootDir, validationIssues)),
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

export function renderManifestPlan(plan: ExecutionPlanDto): string {
  const header = "## Manifest Plan";
  const tree = buildManifestPlanTree(plan.manifests);
  const list = renderManifestTree(tree, (item) => {
    const stepCount = item.steps.length;
    const childCount = item.children.length;
    const childSuffix = childCount > 0 ? ` 👥 ${childCount}` : "";

    return `${item.manifest.id} (${item.manifest.path}) 👣 ${stepCount}${childSuffix}`;
  });

  return [header, "", list].join("\n");
}

export function renderManifestList<T extends { readonly manifest: Manifest }>(
  items: readonly T[],
  render: (item: T) => string,
): string {
  if (items.length === 0) return "";

  return items.map((item) => `- ${render(item)}`).join("\n");
}

function renderManifestTree<T extends { readonly children: readonly T[] }>(
  items: readonly T[],
  render: (item: T) => string,
  depth = 0,
): string {
  if (items.length === 0) return "";

  const lines: string[] = [];
  const prefix = "  ".repeat(depth);

  for (const item of items) {
    lines.push(`${prefix}- ${render(item)}`);

    const children = renderManifestTree(item.children, render, depth + 1);
    if (children.length === 0) continue;

    lines.push(children);
  }

  return lines.join("\n");
}

type ManifestValidationIssue = {
  readonly error: unknown;
  readonly path: string;
};
