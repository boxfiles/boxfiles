import type { TValidationError } from "typebox/error";

export type TypeboxError<T = object> = T & {
  errors: TValidationError[];
  manifestPath?: string;
};

export type PluginReproducibilityWarning = {
  readonly kind: "npm" | "git" | "file";
  readonly name: string;
  readonly source: string;
  readonly message: string;
};

export function pluginReproducibilityWarning(name: string, source: string): PluginReproducibilityWarning {
  const kind = source.startsWith("git:") ? "git" : source.startsWith("file:") ? "file" : "npm";

  if (kind === "npm") {
    return {
      kind,
      name,
      source,
      message: "npm source is floating and unlocked; not integrity-locked; planning uses the cached artifact, not live npm",
    };
  }

  if (kind === "git") {
    return {
      kind,
      name,
      source,
      message: "git source uses remote default branch; not integrity-locked; planning uses the cached artifact, not live git",
    };
  }

  return {
    kind,
    name,
    source,
    message: "file source is local machine state; planning uses the local path directly",
  };
}

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

function isTypeboxLikeError(error: unknown): error is TypeboxError {
  return isRecord(error) && Array.isArray(error.errors);
}

export function formatPluginReproducibilityWarnings(
  warnings: readonly PluginReproducibilityWarning[],
): string {
  if (warnings.length === 0) return "";

  const lines = ["## Plugin Reproducibility Warnings", ""];

  for (const warning of warnings) {
    lines.push(`- \`${warning.name}\` (${warning.kind}): ${warning.message}`);
    lines.push("  - source: `" + warning.source + "`");
    lines.push("");
  }

  while (lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

export function formatCommandError(error: unknown): string {
  if (isTypeboxLikeError(error)) {
    return prettyPrintTypeboxErrors(error);
  }

  if (error instanceof Error) {
    return ["## Error", "", `- message: ${error.message}`].join("\n");
  }

  return ["## Error", "", `- message: ${String(error)}`].join("\n");
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

function formatPath(path: string): string {
  return path.length === 0 ? "#" : path;
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
