import type { ActionProviderMap, ContextDefinition } from "@boxfiles/core";

export type { ContextDefinition, ContextResolver, ContextEntry, FactResolverContext, JsonValue } from "@boxfiles/core";

export type BoxfilePlugin<
    TContext extends ContextDefinition = ContextDefinition,
    TActions extends ActionProviderMap = ActionProviderMap,
> = {
    readonly id: string;
    readonly context?: TContext;
    readonly actions?: TActions;
};

export type PluginSummaryDto = {
    readonly id: string;
    readonly source: string;
    readonly contextKeys: readonly string[];
    readonly actionKinds: readonly string[];
};

export function createPlugin<
    const TContext extends ContextDefinition = ContextDefinition,
    const TActions extends ActionProviderMap = ActionProviderMap,
>(plugin: BoxfilePlugin<TContext, TActions>): BoxfilePlugin<TContext, TActions> {
    return plugin;
}
