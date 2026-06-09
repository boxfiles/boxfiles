import { IsValidationError } from "typebox/error";
import type { TValidationError } from "typebox/error";
import { ManifestCompileError } from "./compile";
import { ManifestDiscoveryError } from "./discovery";
import { ManifestError } from "./manifest-base";

export type TypeboxValidationErrorLike = {
  readonly schema: unknown;
  readonly value: unknown;
  readonly errors: readonly TValidationError[];
};

export class NoProviderRegisteredError extends ManifestCompileError {
  readonly manifestId: string;
  readonly actionKind: string;

  constructor(manifestId: string, actionKind: string) {
    super(
      `No provider registered for action kind: ${actionKind} in ${manifestId}`,
    );
    this.manifestId = manifestId;
    this.actionKind = actionKind;
  }
}

export class InvalidActionConfigError extends ManifestCompileError {
  readonly manifestId: string;
  readonly actionKind: string;
  readonly errors: readonly string[];

  constructor(
    manifestId: string,
    actionKind: string,
    errors: readonly string[],
  ) {
    super(
      `Invalid config for action kind ${actionKind} in ${manifestId}: ${errors.join(", ")}`,
    );
    this.manifestId = manifestId;
    this.actionKind = actionKind;
    this.errors = errors;
  }
}

export class ManifestIdDerivationError extends ManifestDiscoveryError {
  readonly manifestPath: string;

  constructor(manifestPath: string) {
    super(`Cannot derive manifest id from path: ${manifestPath}`);
    this.manifestPath = manifestPath;
  }
}

export class ManifestContentParseError extends ManifestDiscoveryError {
  readonly manifestPath: string;
  override readonly cause: unknown;

  constructor(manifestPath: string, cause: unknown) {
    super(`Failed to parse manifest content at path: ${manifestPath}`);
    this.manifestPath = manifestPath;
    this.cause = cause;
  }
}

export class ManifestSchemaValidationError extends ManifestDiscoveryError {
  readonly manifestPath: string;
  readonly schema: unknown;
  readonly value: unknown;
  readonly errors: readonly TValidationError[];

  constructor(
    manifestPath: string,
    value: unknown,
    error: TypeboxValidationErrorLike,
  ) {
    super(`Validation failed for manifest at path: ${manifestPath}`);
    this.manifestPath = manifestPath;
    this.schema = error.schema;
    this.value = error.value ?? value;
    this.errors = error.errors;
  }
}

export class EmptyManifestIdError extends ManifestError {
  constructor() {
    super("Manifest id must not be empty");
  }
}

export class EmptyStepIdError extends ManifestError {
  constructor() {
    super("Step id must not be empty");
  }
}

export class UnsupportedManifestExtensionError extends ManifestDiscoveryError {
  readonly manifestPath: string;

  constructor(manifestPath: string) {
    super(`Unsupported manifest extension for path: ${manifestPath}`);
    this.manifestPath = manifestPath;
  }
}

export class ManifestDependencyMissingError extends ManifestCompileError {
  readonly manifestId: string;
  readonly dependencyId: string;

  constructor(manifestId: string, dependencyId: string) {
    super(
      `Manifest ${manifestId} depends on missing manifest: ${dependencyId}`,
    );
    this.manifestId = manifestId;
    this.dependencyId = dependencyId;
  }
}

export class ManifestDependencyAmbiguousError extends ManifestCompileError {
  readonly manifestId: string;
  readonly dependencyId: string;
  readonly matches: readonly string[];

  constructor(
    manifestId: string,
    dependencyId: string,
    matches: readonly string[],
  ) {
    super(
      `Manifest ${manifestId} dependency ${dependencyId} is ambiguous: ${matches.join(", ")}`,
    );
    this.manifestId = manifestId;
    this.dependencyId = dependencyId;
    this.matches = matches;
  }
}

export class ManifestDependencyCycleError extends ManifestCompileError {
  readonly manifestId: string;

  constructor(manifestId: string) {
    super(`Manifest dependency cycle detected at: ${manifestId}`);
    this.manifestId = manifestId;
  }
}

export class UnexpectedEmptyDependencyMatchError extends ManifestCompileError {
  readonly manifestId: string;
  readonly dependencyId: string;

  constructor(manifestId: string, dependencyId: string) {
    super(
      `Unexpected empty dependency match while resolving ${dependencyId} in ${manifestId}`,
    );
    this.manifestId = manifestId;
    this.dependencyId = dependencyId;
  }
}

function extractTypeboxError(
  error: unknown,
): TypeboxValidationErrorLike | null {
  if (!isTypeboxErrorLike(error)) return null;

  return error;
}

function isTypeboxErrorLike(
  error: unknown,
): error is TypeboxValidationErrorLike {
  if (!isRecord(error)) return false;
  if (!("schema" in error)) return false;
  if (!("value" in error)) return false;
  if (!("errors" in error)) return false;

  const errors = (error as { readonly errors: unknown }).errors;
  return (
    Array.isArray(errors) && errors.every((item) => IsValidationError(item))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
