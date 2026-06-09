import { BoxfilesError } from "./base";

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

export class PluginIdError extends BoxfilesError {
  constructor() {
    super("Plugin id must be a non-empty string");
  }
}

export class PluginContextShapeError extends BoxfilesError {
  constructor(pluginId: string) {
    super(`Plugin ${pluginId} context must be a plain object`);
  }
}

export class PluginContextKeyError extends BoxfilesError {
  constructor(pluginId: string) {
    super(`Plugin ${pluginId} context key must be non-empty`);
  }
}

export class PluginContextEntryError extends BoxfilesError {
  constructor(pluginId: string, key: string) {
    super(`Plugin ${pluginId} context entry is invalid: ${key}`);
  }
}

export class PluginActionsShapeError extends BoxfilesError {
  constructor(pluginId: string) {
    super(`Plugin ${pluginId} actions must be a plain object`);
  }
}

export class ActionProviderShapeError extends BoxfilesError {
  constructor(pluginId: string) {
    super(`Plugin ${pluginId} action provider must be an object`);
  }
}

export class ActionProviderKindError extends BoxfilesError {
  constructor(pluginId: string) {
    super(`Plugin ${pluginId} action provider kind must be non-empty`);
  }
}

export class ActionProviderSchemaError extends BoxfilesError {
  constructor(pluginId: string, kind: string) {
    super(`Plugin ${pluginId} action provider ${kind} must include schema`);
  }
}

export class ActionProviderMethodError extends BoxfilesError {
  constructor(pluginId: string, kind: string, method: "validate" | "plan" | "apply") {
    super(`Plugin ${pluginId} action provider ${kind} must include ${method}()`);
  }
}

export class PluginContextValueError extends BoxfilesError {
  constructor(pluginId: string, key: string) {
    super(`Plugin ${pluginId} context value is not JSON-ish: ${key}`);
  }
}
