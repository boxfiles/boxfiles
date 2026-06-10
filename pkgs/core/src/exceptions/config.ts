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
