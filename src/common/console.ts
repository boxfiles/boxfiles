import { IsValidationError } from "typebox/error";
import type { TValidationError } from "typebox/error";
import { ManifestError } from "../exceptions/manifest-base";

export function renderList<T>(
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

type TypeboxError<T = object> = T & {
  errors: TValidationError[];
  manifestPath?: string;
};

export function prettyPrintTypeboxErrors(error: TypeboxError): string {
  if (!error.errors || error.errors.length === 0) {
    return "## Validation Error\n\nNo details available.";
  }

  const lines = ["## Validation Errors", ""];

  if (typeof error.manifestPath === "string" && error.manifestPath.length > 0) {
    lines.push(`- manifest path: \`${error.manifestPath}\``);
    lines.push("");
  }

  for (const validationError of error.errors) {
    lines.push(...renderValidationError(validationError));
    lines.push("");
  }

  while (lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

function isTypeboxError(error: unknown): error is TypeboxError {
  if (!isRecord(error)) return false;
  if (!("errors" in error)) return false;

  const errors = (error as { readonly errors: unknown }).errors;
  return Array.isArray(errors) && errors.every((item) => IsValidationError(item));
}

function renderValidationError(error: TValidationError): string[] {
  const lines = [`- **${error.keyword}** at \`${formatPath(error.instancePath)}\``];

  if (error.schemaPath) {
    lines.push(`  - schema path: \`${error.schemaPath}\``);
  }

  const message = readValidationMessage(error);
  if (message !== null) {
    lines.push(`  - message: ${message}`);
  }

  const params = renderMappedValue(error.params, 2);
  if (params.length > 0) {
    lines.push("  - params:");
    lines.push(...params);
  }

  return lines;
}

function renderMappedValue(value: unknown, depth: number): string[] {
  const pad = "  ".repeat(depth);

  if (value === null) return [`${pad}- null`];
  if (typeof value === "string") return [`${pad}- \`${value}\``];
  if (typeof value === "number" || typeof value === "boolean") {
    return [`${pad}- \`${String(value)}\``];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}- []`];

    const lines: string[] = [];
    for (const entry of value) {
      lines.push(...renderMappedValue(entry, depth));
    }

    return lines;
  }

  if (!isRecord(value)) return [`${pad}- \`${String(value)}\``];

  const lines: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (isPrimitive(entry)) {
      lines.push(`${pad}- ${key}: \`${String(entry)}\``);
      continue;
    }

    lines.push(`${pad}- ${key}:`);
    lines.push(...renderMappedValue(entry, depth + 1));
  }

  return lines;
}

function readValidationMessage(error: TValidationError): string | null {
  const message = (error as { readonly message?: unknown }).message;
  if (typeof message !== "string" || message.length === 0) return null;

  return message;
}

function prettyPrintManifestError(error: ManifestError): string {
  const lines = ["## Error", ""];
  const details = renderManifestErrorDetails(error);
  if (details.length > 0) {
    lines.push(...details);
    lines.push("");
  }

  lines.push("```txt");
  lines.push(`${error.name}: ${error.message}`);
  lines.push("```");

  return lines.join("\n");
}

function renderManifestErrorDetails(error: ManifestError): string[] {
  const lines: string[] = [];
  const manifestPath = readStringProp(error, "manifestPath");
  if (manifestPath !== null) {
    lines.push(`- manifest path: \`${manifestPath}\``);
  }

  const manifestId = readStringProp(error, "manifestId");
  if (manifestId !== null) {
    lines.push(`- manifest id: \`${manifestId}\``);
  }

  const actionKind = readStringProp(error, "actionKind");
  if (actionKind !== null) {
    lines.push(`- action kind: \`${actionKind}\``);
  }

  const dependencyId = readStringProp(error, "dependencyId");
  if (dependencyId !== null) {
    lines.push(`- dependency id: \`${dependencyId}\``);
  }

  return lines;
}

function readStringProp(value: object, key: string): string | null {
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

export function formatCommandError(error: unknown): string {
  if (isTypeboxError(error)) return prettyPrintTypeboxErrors(error);
  if (error instanceof ManifestError) return prettyPrintManifestError(error);

  const content =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  return ["## Error", "", "```", content, "```"].join("\n");
}

function formatPath(path: string): string {
  return path.length === 0 ? "#" : path;
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
