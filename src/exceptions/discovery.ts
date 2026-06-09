import { ManifestError } from "./manifest-base";

export abstract class ManifestDiscoveryError extends ManifestError {
  constructor(message: string) {
    super(message);
  }
}
