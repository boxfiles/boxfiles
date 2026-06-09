import { BoxfilesError } from "./base";

export class EmptyFactKeyError extends BoxfilesError {
  constructor() {
    super("Fact key must not be empty");
  }
}

export class DuplicateContextFactError extends BoxfilesError {
  constructor(factKey: string) {
    super(`Context fact already exists: ${factKey}`);
  }
}

export class InvalidFactCollisionPolicyError extends BoxfilesError {
  constructor(value: string) {
    super(`Unexpected fact collision policy: ${value}`);
  }
}
