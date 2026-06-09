import { BoxfilesError } from "./base";

export abstract class ManifestError extends BoxfilesError {
  constructor(message: string) {
    super(message);
  }
}
