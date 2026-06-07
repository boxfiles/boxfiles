/**
 * Plan service
 *
 * Takes a tree of manifests, the facts context and compiles a plan of actions to be taken.
 */

import Type from "typebox";
import { NonBlankStringSchema } from "../common/schema";
import {
    ActionKindSchema,
    CompiledManifestSchema,
    ManifestIdSchema,
    StepIdSchema,
} from "./Manifest";
import type { Manifest } from "./Manifest";
import type { ContextSnapshot } from "./Context";


export const ActionSafetySchema = Type.Object({
    idempotent: Type.Readonly(Type.Boolean()),
    unsafe: Type.Readonly(Type.Boolean()),
    requiresConfirmation: Type.Readonly(Type.Boolean()),
    reason: Type.Readonly(Type.Optional(NonBlankStringSchema)),
});

export type ActionSafetyDto = Type.Static<typeof ActionSafetySchema>;

export const PlannedChangeOperationSchema = Type.Union([
    Type.Literal("create"),
    Type.Literal("update"),
    Type.Literal("delete"),
    Type.Literal("execute"),
    Type.Literal("noop"),
]);

export const PlannedChangeSchema = Type.Object({
    target: Type.Readonly(NonBlankStringSchema),
    operation: Type.Readonly(PlannedChangeOperationSchema),
    before: Type.Readonly(Type.Optional(Type.Unknown())),
    after: Type.Readonly(Type.Optional(Type.Unknown())),
    message: Type.Readonly(Type.Optional(NonBlankStringSchema)),
});

export type PlannedChangeDto = Type.Static<typeof PlannedChangeSchema>;

export const ActionPlanSchema = Type.Object({
    actionId: Type.Readonly(StepIdSchema),
    manifestId: Type.Readonly(ManifestIdSchema),
    kind: Type.Readonly(ActionKindSchema),
    summary: Type.Readonly(NonBlankStringSchema),
    safety: Type.Readonly(ActionSafetySchema),
    changes: Type.Readonly(Type.Array(PlannedChangeSchema)),
});

export type ActionPlanDto = Type.Static<typeof ActionPlanSchema>;

export const ExecutionPlanSchema = Type.Object({
    manifests: Type.Readonly(Type.Array(CompiledManifestSchema)),
    actions: Type.Readonly(Type.Array(ActionPlanSchema)),
});

export type ExecutionPlanDto = Type.Static<typeof ExecutionPlanSchema>;

export class PlanService {
    plan: Plan | null = null;

    constructor(
        public manifests: readonly Manifest[],
        public context: ContextSnapshot,
    ) {}

    compile(): Plan {
        // TODO: implement the logic to compile a plan from the manifests and context.
        return new Plan();
    }
}

class Plan {
    steps: PlanStep[] = [];
}

class PlanStep {}
