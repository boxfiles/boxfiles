import Type from "typebox";

type ProviderConfigSchema<T> = Type.TSchema; // Placeholder for a schema validation library type
type ValidationResult<TConfig> =
    | { success: true; value: TConfig }
    | { success: false; errors: string[] };
type ResolvedAction<TConfig> = { uses: string; with: TConfig };
type ActionPlanDto = unknown; // Placeholder for the data structure that represents a planned action
type ActionResultDto = unknown;
type ActionContext = unknown; // Placeholder for any contextual information that might be needed during planning/applying actions

/**
 * BoxfileProvider is a plugin interface that allows
 * authors/users to define custom providers that can be used in Boxfiles.
 */
interface BoxfileProvider<TConfig> {
    kind: string;
    schema: ProviderConfigSchema<TConfig>;

    validate(config: unknown): ValidationResult<TConfig>;

    plan(input: {
        action: ResolvedAction<TConfig>;
        plan: ActionPlanDto;
        ctx: ActionContext;
    }): Promise<ActionPlanDto>;

    apply(input: {
        action: ResolvedAction<TConfig>;
        plan: ActionPlanDto;
        ctx: ActionContext;
    }): Promise<ActionResultDto>;
}

/**
 * Public API for users/authors to create Boxfile plugins
 */
export function createPlugin<ProviderConfigSchema>(
    /** Unique identifier for the plugin, used in the `uses` field of manifest steps. */
    id: string,
    configSchema: ProviderConfigSchema,
    /** Factory function that takes a context and returns a BoxfileProvider instance. The context can be used to access other services or resources that the plugin might need. */
    factory: (ctx: unknown) => BoxfileProvider<ProviderConfigSchema>,
): BoxfileProvider<ProviderConfigSchema> {
    throw new Error("createPlugin is not implemented");
}

// TODO: this is a placeholder for the plugin service, which will be responsible for loading and managing plugins. It will likely need to discover plugins from the filesystem, load them, and provide them to the manifest service when parsing manifests.
// For now, it just has a plugins record and a constructor that takes a root directory.
//
// Intention:
// - on cli startup we look at what plugins are in .boxfilesrc.yaml/toml  or in .boxfiles/providers/*.ts
// - load them and register them in the plugin service
// - make them available in the manifest service when parsing manifests, so that
//   when we encounter a step that uses a plugin, we can validate the config and
//   plan/apply the action using the plugin's methods.
export class PluginService {
    public plugins: Record<string, BoxfileProvider<unknown>> = {};
    constructor(public readonly rootDir: string) {}
}
