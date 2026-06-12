import Type from "typebox";
import {
    ActionProviderKindError,
    ActionProviderMethodError,
    ActionProviderSchemaError,
    ActionProviderShapeError,
    PluginActionsShapeError,
    PluginContextEntryError,
    PluginContextKeyError,
    PluginContextShapeError,
    PluginContextValueError,
    PluginIdError,
    PluginModuleShapeError,
} from "../../exceptions/plugins";
import type {
    ActionProvider,
    ActionProviderMap,
    BoxfilePlugin,
    ContextDefinition,
    JsonArray,
    JsonObject,
    JsonValue,
    PluginModule,
} from "./domain";

export function normalizePluginModule(moduleValue: unknown): BoxfilePlugin {
    const candidate = isObject(moduleValue) && "default" in moduleValue
        ? (moduleValue as PluginModule).default
        : moduleValue;

    assertPluginShape(candidate);
    return candidate;
}

export function assertPluginShape(value: unknown): asserts value is BoxfilePlugin {
    if (!isObject(value)) {
        throw new PluginModuleShapeError();
    }

    if (!isNonBlankString(value.id)) {
        throw new PluginIdError();
    }

    if (value.context !== undefined) {
        assertContextShape(value.id, value.context);
    }

    if (value.actions !== undefined) {
        assertActionsShape(value.id, value.actions);
    }
}

export function assertActionProviderShape(
    value: unknown,
    pluginId: string,
): asserts value is ActionProvider<Type.TSchema> {
    if (!isObject(value)) {
        throw new ActionProviderShapeError(pluginId);
    }

    if (!isNonBlankString(value.kind)) {
        throw new ActionProviderKindError(pluginId);
    }

    if (!isObject(value.schema)) {
        throw new ActionProviderSchemaError(pluginId, value.kind);
    }

    if (typeof value.validate !== "function") {
        throw new ActionProviderMethodError(pluginId, value.kind, "validate");
    }

    if (typeof value.plan !== "function") {
        throw new ActionProviderMethodError(pluginId, value.kind, "plan");
    }

    if (typeof value.apply !== "function") {
        throw new ActionProviderMethodError(pluginId, value.kind, "apply");
    }
}

function assertContextShape(
    pluginId: string,
    value: unknown,
): asserts value is ContextDefinition {
    if (!isPlainObject(value)) {
        throw new PluginContextShapeError(pluginId);
    }

    for (const [key, entry] of Object.entries(value)) {
        if (!isNonBlankString(key)) {
            throw new PluginContextKeyError(pluginId);
        }

        if (typeof entry === "function") continue;
        if (isJsonValue(entry)) continue;

        throw new PluginContextEntryError(pluginId, key);
    }
}

function assertActionsShape(
    pluginId: string,
    value: unknown,
): asserts value is ActionProviderMap {
    if (!isPlainObject(value)) {
        throw new PluginActionsShapeError(pluginId);
    }

    for (const provider of Object.values(value)) {
        assertActionProviderShape(provider, pluginId);
    }
}

export function isJsonValue(value: unknown): value is JsonValue {
    if (value === null) return true;

    switch (typeof value) {
        case "string":
        case "number":
        case "boolean":
            return true;
        case "object":
            return isJsonObjectOrArray(value);
        default:
            return false;
    }
}

function isJsonObjectOrArray(value: object): value is JsonArray | JsonObject {
    if (Array.isArray(value)) return value.every(isJsonValue);
    if (!isPlainObject(value)) return false;

    return Object.values(value).every(isJsonValue);
}

function isObject(value: unknown): value is { readonly [key: string]: unknown } {
    return typeof value === "object" && value !== null;
}

function isPlainObject(value: unknown): value is { readonly [key: string]: unknown } {
    if (!isObject(value)) return false;

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isNonBlankString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}
