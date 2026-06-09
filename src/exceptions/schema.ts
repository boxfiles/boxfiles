import { BoxfilesError } from "./base";

export class UnknownSchemaNameError extends BoxfilesError {
  constructor(value: string) {
    super(`Unknown schema name: ${value}. Expected all, manifest, or boxfilesrc.`);
  }
}
