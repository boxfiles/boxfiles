import Type from "typebox";
import type { ContextSnapshot } from "./Context";
import type { ManifestContextDto, ResolvedStep } from "./Manifest";
import { ActionPlanSchema, type ActionPlanDto } from "./Plan";

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

export type ActionConfig<TConfigSchema extends Type.TSchema> = Type.Static<TConfigSchema>;

export const ActionValidationResultSchema = Type.Union([
    Type.Object({
        success: Type.Readonly(Type.Literal(true)),
        value: Type.Readonly(Type.Unknown()),
    }),
    Type.Object({
        success: Type.Readonly(Type.Literal(false)),
        errors: Type.Readonly(Type.Array(Type.String())),
    }),
]);

export const ActionApplyResultSchema = Type.Object({
    actionId: Type.Readonly(Type.String()),
    success: Type.Readonly(Type.Boolean()),
    message: Type.Readonly(Type.Optional(Type.String())),
});

export const ActionProviderPlanInputSchema = Type.Object({
    action: Type.Readonly(Type.Unknown()),
    plan: Type.Readonly(Type.Union([Type.Null(), Type.Unknown()])),
    ctx: Type.Readonly(Type.Object({
        rootDir: Type.String(),
        facts: Type.Record(Type.String(), Type.Unknown()),
        manifest: Type.Unknown(),
    })),
});

export const ActionProviderApplyInputSchema = Type.Object({
    action: Type.Readonly(Type.Unknown()),
    plan: Type.Readonly(Type.Unknown()),
    ctx: Type.Readonly(Type.Object({
        rootDir: Type.String(),
        facts: Type.Record(Type.String(), Type.Unknown()),
        manifest: Type.Unknown(),
    })),
});

export function ActionProviderSchema<const TConfigSchema extends Type.TSchema>(configSchema: TConfigSchema) {
    return Type.Object({
        kind: Type.Readonly(Type.String()),
        schema: Type.Readonly(configSchema),
        validate: Type.Readonly(
            Type.Function([Type.Unknown()], ActionValidationResultSchema),
        ),
        plan: Type.Readonly(
            Type.Function(
                [ActionProviderPlanInputSchema],
                Type.Promise(ActionPlanSchema),
            ),
        ),
        apply: Type.Readonly(
            Type.Function(
                [ActionProviderApplyInputSchema],
                Type.Promise(ActionApplyResultSchema),
            ),
        ),
    });
}

export interface ActionProvider<
    TConfigSchema extends Type.TSchema = Type.TSchema,
> {
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

export type ActionProviderMap = {
    readonly [kind: string]: ActionProvider;
};

export type ActionProviderRegistry = {
    readonly getActionProvider: (kind: string) => ActionProvider<Type.TSchema> | null;
};
