import Type from "typebox";
import type { ContextFact, ContextService } from "./Context";
import { type ContextSnapshot, ContextService as RuntimeContextService } from "./Context";
import type { ManifestContextDto, ResolvedStep } from "./Manifest";
import type { ActionPlanDto } from "./Plan";
import {
    ActionProviderAlreadyRegisteredError,
    ActionProviderKindError,
    ActionProviderMethodError,
    ActionProviderSchemaError,
    ActionProviderShapeError,
    PluginActionsShapeError,
    PluginAlreadyRegisteredError,
    PluginContextEntryError,
    PluginContextKeyError,
    PluginContextShapeError,
    PluginContextValueError,
    PluginIdError,
    PluginModuleShapeError,
} from "../exceptions/plugins";

export type ValidationResult<TConfig> =
    | { readonly success: true; readonly value: TConfig }
    | { readonly success: false; readonly errors: readonly string[] };

export type ActionApplyResultDto = {
    readonly actionId: string;
    readonly success: boolean;
    readonly message?: string;
};

export type ActionContext = {
    readonly rootDir: string;
    readonly facts: ContextSnapshot;
    readonly manifest: ManifestContextDto;
};

export type ActionConfig<TConfigSchema extends Type.TSchema> =
    Type.Static<TConfigSchema>;

export interface ActionProvider<TConfigSchema extends Type.TSchema = Type.TSchema> {
    readonly kind: string;
    readonly schema: TConfigSchema;

    validate(config: unknown): ValidationResult<ActionConfig<TConfigSchema>>;

    plan(input: {
        readonly action: ResolvedStep<ActionConfig<TConfigSchema>>;
        readonly plan: ActionPlanDto | null;
        readonly ctx: ActionContext;
    }): Promise<ActionPlanDto>;

    apply(input: {
        readonly action: ResolvedStep<ActionConfig<TConfigSchema>>;
        readonly plan: ActionPlanDto;
        readonly ctx: ActionContext;
    }): Promise<ActionApplyResultDto>;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

export type FactResolverContext = {
    readonly rootDir: string;
    readonly pluginId: string;
    readonly facts: ContextSnapshot;
};

export type ContextResolver = (
    ctx: FactResolverContext,
) => JsonValue | Promise<JsonValue>;

export type ContextEntry = JsonValue | ContextResolver;
export type ContextDefinition = { readonly [key: string]: ContextEntry };
export type ActionProviderMap = {
    readonly [kind: string]: ActionProvider<Type.TSchema>;
};

export type BoxfilePlugin<
    TContext extends ContextDefinition = ContextDefinition,
    TActions extends ActionProviderMap = ActionProviderMap,
> = {
    readonly id: string;
    readonly context?: TContext;
    readonly actions?: TActions;
};

export type PluginModule = {
    readonly default?: unknown;
};

export type PluginSource = "builtin" | "user" | "npm";
export type PluginSummaryDto = {
    readonly id: string;
    readonly source: PluginSource;
    readonly contextKeys: readonly string[];
    readonly actionKinds: readonly string[];
};

/**
 * Public author API. Keeps plugin declaration low ceremony while preserving
 * inferred context/action keys in TypeScript.
 */
export function createPlugin<
    const TContext extends ContextDefinition = ContextDefinition,
    const TActions extends ActionProviderMap = ActionProviderMap,
>(plugin: BoxfilePlugin<TContext, TActions>): BoxfilePlugin<TContext, TActions> {
    assertPluginShape(plugin);
    return plugin;
}

export class PluginService {
    private readonly pluginRegistry = new Map<string, BoxfilePlugin>();
    private readonly actionProviders = new Map<string, ActionProvider<Type.TSchema>>();
    private readonly pluginSources = new Map<string, PluginSource>();

    constructor(public readonly rootDir: string) {}

    get plugins(): Readonly<Record<string, ActionProvider<Type.TSchema>>> {
        return Object.fromEntries(this.actionProviders.entries());
    }

    registerPlugin(plugin: BoxfilePlugin, source: PluginSource = "user"): void {
        assertPluginShape(plugin);
        if (this.pluginRegistry.has(plugin.id)) {
            throw new PluginAlreadyRegisteredError(plugin.id);
        }

        this.pluginRegistry.set(plugin.id, plugin);
        this.pluginSources.set(plugin.id, source);
        for (const provider of Object.values(plugin.actions ?? {})) {
            this.registerActionProvider(plugin.id, provider);
        }
    }

    registerModule(moduleValue: unknown): BoxfilePlugin {
        const plugin = normalizePluginModule(moduleValue);
        this.registerPlugin(plugin);
        return plugin;
    }

    getActionProvider(kind: string): ActionProvider<Type.TSchema> | null {
        return this.actionProviders.get(kind) ?? null;
    }

    listPlugins(): readonly PluginSummaryDto[] {
        return [...this.pluginRegistry.values()]
            .map((plugin) => ({
                id: plugin.id,
                source: this.pluginSources.get(plugin.id) ?? "user",
                contextKeys: Object.keys(plugin.context ?? {}).sort((left, right) =>
                    left.localeCompare(right),
                ),
                actionKinds: Object.values(plugin.actions ?? {})
                    .map((provider) => provider.kind)
                    .sort((left, right) => left.localeCompare(right)),
            }))
            .sort((left, right) => left.id.localeCompare(right.id));
    }

    async gatherContextFacts(
        contextService: ContextService,
    ): Promise<readonly ContextFact[]> {
        const gathered: ContextFact[] = [];
        for (const plugin of this.pluginRegistry.values()) {
            const context = plugin.context ?? {};
            for (const [key, entry] of Object.entries(context)) {
                const fact = await this.evaluateContextEntry(plugin.id, key, entry, contextService);
                contextService.set(fact);
                gathered.push(fact);
            }
        }

        return gathered;
    }

    private registerActionProvider(
        pluginId: string,
        provider: ActionProvider<Type.TSchema>,
    ): void {
        assertActionProviderShape(provider, pluginId);
        if (this.actionProviders.has(provider.kind)) {
            throw new ActionProviderAlreadyRegisteredError(provider.kind);
        }

        this.actionProviders.set(provider.kind, provider);
    }

    private async evaluateContextEntry(
        pluginId: string,
        key: string,
        entry: ContextEntry,
        contextService: ContextService,
    ): Promise<ContextFact> {
        const valueKind = typeof entry === "function" ? "computed" : "static";
        const value = typeof entry === "function"
            ? await entry({
                  rootDir: this.rootDir,
                  pluginId,
                  facts: contextService.snapshot(),
              })
            : entry;

        if (!isJsonValue(value)) {
            throw new PluginContextValueError(pluginId, key);
        }

        return {
            key: RuntimeContextService.factKey(key),
            source: "plugin",
            value,
            metadata: {
                source: "plugin",
                pluginId,
                providerId: key,
                valueKind,
                sensitive: false,
                collision: "error",
            },
        };
    }
}

export function normalizePluginModule(moduleValue: unknown): BoxfilePlugin {
    const candidate = isObject(moduleValue) && "default" in moduleValue
        ? (moduleValue as PluginModule).default
        : moduleValue;

    assertPluginShape(candidate);
    return candidate;
}

function assertPluginShape(value: unknown): asserts value is BoxfilePlugin {
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

function assertActionProviderShape(
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

function isJsonValue(value: unknown): value is JsonValue {
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
