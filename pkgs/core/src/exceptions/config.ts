import type { TValidationError } from "typebox/error";
import { BoxfilesError } from "./base";
import type { TypeboxValidationErrorLike } from "./manifest";

export class BoxfilesRcValidationError extends BoxfilesError {
  readonly schema: unknown;
  readonly value: unknown;
  readonly errors: readonly TValidationError[];

  constructor(value: unknown, error: TypeboxValidationErrorLike) {
    super("Validation failed for .boxfilesrc config");
    this.schema = error.schema;
    this.value = error.value ?? value;
    this.errors = error.errors;
  }
}

export class BoxfilesRcReadError extends BoxfilesError {
  readonly path: string;
  override readonly cause: unknown;

  constructor(path: string, cause: unknown) {
    super(`Unable to read .boxfilesrc at ${path}: ${formatUnknownError(cause)}`);
    this.path = path;
    this.cause = cause;
  }
}

export class BoxfilesRcParseError extends BoxfilesError {
  readonly path: string;
  override readonly cause: unknown;

  constructor(path: string, cause: unknown) {
    super(`Unable to parse .boxfilesrc at ${path} as JSON: ${formatUnknownError(cause)}`);
    this.path = path;
    this.cause = cause;
  }
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
