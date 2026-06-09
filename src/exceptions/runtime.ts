import { BoxfilesError } from "./base";

export class RuntimeNotActiveError extends BoxfilesError {
  constructor() {
    super("Boxfiles runtime is not active");
  }
}

export class RuntimeRootMismatchError extends BoxfilesError {
  constructor(expectedRootDir: string, actualRootDir: string) {
    super(`Runtime root mismatch: expected ${expectedRootDir}, got ${actualRootDir}`);
  }
}
