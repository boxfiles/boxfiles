import Type from "typebox";
import type { ContextSnapshot } from "../Context";
import type { ManifestContextDto, ResolvedStep } from "../Manifest";
import type { ActionPlanDto } from "../Plan";
import { assertPluginShape } from "./validation";

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

export type PluginSource = "builtin" | "user" | "npm" | "git" | "file";
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
