import Type from "typebox";
import type { ContextFact, ContextService } from "../Context";
import { ContextService as RuntimeContextService } from "../Context";
import {
    ActionProviderAlreadyRegisteredError,
    PluginAlreadyRegisteredError,
    PluginContextValueError,
} from "../../exceptions/plugins";
import type {
    ActionProvider,
    BoxfilePlugin,
    ContextEntry,
    PluginSource,
    PluginSummaryDto,
} from "./domain";
import { assertActionProviderShape, assertPluginShape, isJsonValue, normalizePluginModule } from "./validation";

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
