import { app } from "../app";
import { gatherRuntimeContextSnapshot, getActiveRuntime } from "../runtime";
import { markdownView } from "../views/markdown";

export const contextCmd = app
  .sub("context")
  .meta({
    description: "Inspect gathered runtime context facts.",
  })
  .command("facts", (cmd) => cmd
    .meta({
      description: "List gathered Context Facts.",
    })
    .flags({
      json: {
        type: "boolean",
        default: false,
        description: "Emit facts as a JSON object.",
      },
      prefix: {
        type: "string",
        description: "Only include facts with this key prefix.",
      },
    })
    .run(async (input) => {
      const facts = await gatherRuntimeContextSnapshot(getActiveRuntime());
      const prefix = readOptionalStringFlag(input.flags, "prefix");
      const sortedFacts = sortFacts(filterFacts(facts, prefix));

      if (readBooleanFlag(input.flags, "json")) {
        console.log(JSON.stringify(sortedFacts, null, 2));
        return;
      }

      console.log(markdownView(renderContextFacts(sortedFacts, prefix)));
    }));

export function filterFacts(
  facts: Readonly<Record<string, unknown>>,
  prefix: string | undefined,
): Readonly<Record<string, unknown>> {
  if (prefix === undefined) return facts;

  return Object.fromEntries(
    Object.entries(facts).filter((entry) => entry[0].startsWith(prefix)),
  );
}

export function sortFacts(
  facts: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(facts).sort((left, right) => compareFactKeys(left[0], right[0])));
}

export function renderContextFacts(
  facts: Readonly<Record<string, unknown>>,
  prefix: string | undefined,
): string {
  const entries = Object.entries(facts);
  if (entries.length === 0) return prefix === undefined
    ? "## Context Facts\n\nNo facts found."
    : `## Context Facts\n\nNo facts found for prefix \`${prefix}\`.`;

  return [
    "## Context Facts",
    "",
    ...entries.map((entry) => `- \`${entry[0]}\`: ${formatFactValue(entry[1])}`),
  ].join("\n");
}

function compareFactKeys(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function formatFactValue(value: unknown): string {
  if (typeof value === "string") return value;
  return `\`${JSON.stringify(value)}\``;
}

function readBooleanFlag(flags: unknown, key: string): boolean {
  if (!isRecord(flags)) return false;
  return flags[key] === true;
}

function readOptionalStringFlag(flags: unknown, key: string): string | undefined {
  if (!isRecord(flags)) return undefined;
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
