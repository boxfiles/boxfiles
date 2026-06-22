import { BoxfilesError } from "@boxfiles/core";

export class PluginAlreadyRegisteredError extends BoxfilesError {
  constructor(pluginId: string) {
    super(`Plugin already registered: ${pluginId}`);
  }
}

export class ActionProviderAlreadyRegisteredError extends BoxfilesError {
  constructor(kind: string) {
    super(`Action provider already registered: ${kind}`);
  }
}

export class PluginModuleShapeError extends BoxfilesError {
  constructor() {
    super("Plugin module must export a plugin object");
  }
}
