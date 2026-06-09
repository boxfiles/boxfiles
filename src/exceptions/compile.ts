import { ManifestError } from "./manifest-base";

export abstract class ManifestCompileError extends ManifestError {
  constructor(message: string) {
    super(message);
  }
}
