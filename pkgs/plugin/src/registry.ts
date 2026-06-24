import type Type from "typebox";
import type { ActionProvider } from "@boxfiles/core";
import {
    ActionProviderAlreadyRegisteredError,
    PluginAlreadyRegisteredError,
} from "./errors";
import { normalizePluginModule } from "./schema";
import type { BoxfilePlugin, PluginSummaryDto } from "./plugin";
import { gatherPluginContextFacts } from "./runtime";
import type { ContextFact, ContextService } from "@boxfiles/core";

export class PluginRegistry {
    private readonly pluginRegistry = new Map<string, BoxfilePlugin>();
    private readonly actionProviders = new Map<string, ActionProvider<Type.TSchema>>();
    private readonly pluginSources = new Map<string, string>();

    constructor(private readonly rootDir = process.cwd()) {}
    registerPlugin(plugin: BoxfilePlugin, source: string = "user"): void {
        if (this.pluginRegistry.has(plugin["id"])) throw new PluginAlreadyRegisteredError(plugin["id"]);

        this.pluginRegistry.set(plugin["id"], plugin);
        this.pluginSources.set(plugin["id"], source);
        for (const provider of Object.values(plugin["actions"] ?? {})) this.registerActionProvider(provider);
    }

    registerModule(moduleValue: unknown): BoxfilePlugin {
        const plugin = normalizePluginModule(moduleValue);
        this.registerPlugin(plugin);
        return plugin;
    }

    getActionProvider(kind: string): ActionProvider<Type.TSchema> | null {
        return this.actionProviders.get(kind) ?? null;
    }


    async gatherContextFacts(contextService: ContextService): Promise<readonly ContextFact[]> {
        const facts: ContextFact[] = [];
        for (const plugin of this.pluginRegistry.values()) {
            facts.push(...await gatherPluginContextFacts(plugin, this.rootDir, contextService));
        }
        return facts;
    }

    listPlugins(): readonly PluginSummaryDto[] {
        return [...this.pluginRegistry.values()]
            .map((plugin) => ({
                id: plugin["id"],
                source: this.pluginSources.get(plugin["id"]) ?? "user",
                contextKeys: Object.keys(plugin["context"] ?? {}).sort((left, right) => left.localeCompare(right)),
                actionKinds: Object.values(plugin["actions"] ?? {})
                    .map((provider) => provider.kind)
                    .sort((left, right) => left.localeCompare(right)),
            }))
            .sort((left, right) => left.id.localeCompare(right.id));
    }

    private registerActionProvider(provider: ActionProvider<Type.TSchema>): void {
        if (this.actionProviders.has(provider.kind)) throw new ActionProviderAlreadyRegisteredError(provider.kind);
        this.actionProviders.set(provider.kind, provider);
    }
}

export const PluginService = PluginRegistry;
export type PluginService = PluginRegistry;
