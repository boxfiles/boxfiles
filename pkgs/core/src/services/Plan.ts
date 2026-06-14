/**
 * Plan service
 *
 * Takes compiled manifests, the facts context, and compiles an execution plan.
 */

import Type from "typebox";
import { NonBlankStringSchema } from "../common/schema";
import {
  EmptyManifestIdError,
  ManifestDependencyAmbiguousError,
  ManifestDependencyCycleError,
  ManifestDependencyMissingError,
  NoProviderRegisteredError,
  UnexpectedEmptyDependencyMatchError,
} from "../exceptions/manifest";
import type { ContextSnapshot } from "./Context";
import {
  ActionKindSchema,
  CompiledManifestSchema,
  ManifestIdSchema,
  StepIdSchema,
  type CompiledManifestDto,
  type ManifestId,
} from "./Manifest";
import type { PluginRegistry } from "./Plugin";

export const ActionSafetySchema = Type.Object({
  idempotent: Type.Readonly(Type.Boolean()),
  unsafe: Type.Readonly(Type.Boolean()),
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

export const PlanExecutionStepResultSchema = Type.Object({
  actionId: Type.Readonly(StepIdSchema),
  success: Type.Readonly(Type.Boolean()),
  message: Type.Readonly(Type.Optional(NonBlankStringSchema)),
});

export const PlanExecutionResultSchema = Type.Object({
  success: Type.Readonly(Type.Boolean()),
  results: Type.Readonly(Type.Array(PlanExecutionStepResultSchema)),
});

export type PlanExecutionStepResultDto = Type.Static<typeof PlanExecutionStepResultSchema>;
export type PlanExecutionResultDto = Type.Static<typeof PlanExecutionResultSchema>;

export type ManifestPlanNode = CompiledManifestDto & {
  readonly children: ManifestPlanNode[];
};

export class PlanService {
  public readonly manifests: readonly CompiledManifestDto[];
  public readonly context: ContextSnapshot;
  private readonly pluginRegistry: PluginRegistry;
  private readonly rootDir: string;

  constructor(
    rootDir: string,
    pluginRegistry: PluginRegistry,
    manifests: readonly CompiledManifestDto[],
    context: ContextSnapshot,
  ) {
    this.rootDir = rootDir;
    this.pluginRegistry = pluginRegistry;
    this.manifests = manifests;
    this.context = context;
  }

  async compile(): Promise<ExecutionPlanDto> {
    const orderedManifests = sortManifestsByDependencies(this.manifests);
    const actions: ActionPlanDto[] = [];

    for (const manifest of orderedManifests) {
      for (const step of manifest.steps) {
        const provider = this.pluginRegistry.getActionProvider(step.uses);
        if (provider === null) {
          throw new NoProviderRegisteredError(manifest.id, step.uses);
        }

        actions.push(
          await provider.plan({
            action: step,
            plan: null,
            ctx: {
              rootDir: this.rootDir,
              facts: this.context,
              manifest: manifest.manifest,
            },
          }),
        );
      }
    }

    return {
      manifests: [...orderedManifests],
      actions,
    };
  }

  summarizeManifests(): readonly ManifestPlanNode[] {
    return buildManifestPlanTree(sortManifestsByDependencies(this.manifests));
  }
}


export class PlanExecutor {
  constructor(
    private readonly pluginRegistry: PluginRegistry,
    private readonly rootDir: string,
  ) {}

  async execute(plan: ExecutionPlanDto, options: { readonly confirmUnsafe: boolean }): Promise<PlanExecutionResultDto> {
    const results: PlanExecutionStepResultDto[] = [];

    for (const action of plan.actions) {
      if (action.safety.unsafe && !options.confirmUnsafe) {
        results.push({ actionId: action.actionId as typeof action.actionId, success: false, message: "unsafe action requires --confirm" });
        return { success: false, results };
      }

      const provider = this.pluginRegistry.getActionProvider(action.kind);
      if (provider === null) {
        results.push({ actionId: action.actionId as typeof action.actionId, success: false, message: `no provider for ${action.kind}` });
        return { success: false, results };
      }

      const manifest = plan.manifests.find((candidate) => candidate.id === action.manifestId);
      if (manifest === undefined) {
        results.push({ actionId: action.actionId as typeof action.actionId, success: false, message: "missing manifest for action" });
        return { success: false, results };
      }

      const step = manifest.steps.find((candidate) => candidate.id === action.actionId);
      if (step === undefined) {
        results.push({ actionId: action.actionId as typeof action.actionId, success: false, message: "missing step for action" });
        return { success: false, results };
      }

      if (!shouldRunStep(step.when)) {
        results.push({ actionId: action.actionId as typeof action.actionId, success: true, message: "skipped by when" });
        continue;
      }

      const applied = await provider.apply({
        action: step,
        plan: action,
        ctx: { rootDir: this.rootDir, facts: {}, manifest: manifest.manifest },
      });

      results.push({
        actionId: action.actionId as typeof action.actionId,
        success: applied.success,
        message: applied.message,
      });
      if (!applied.success) return { success: false, results };
    }

    return { success: true, results };
  }
}

function shouldRunStep(condition: string | undefined): boolean {
  if (condition === undefined) return true;
  const normalized = condition.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
}

export function buildManifestPlanTree(
  manifests: readonly CompiledManifestDto[],
): readonly ManifestPlanNode[] {
  const nodesById = new Map<ManifestId, ManifestPlanNode>(
    manifests.map((manifest) => [
      manifest.id,
      {
        ...manifest,
        children: [],
      },
    ]),
  );
  const parentById = new Map<ManifestId, ManifestId>();

  for (const manifest of manifests) {
    const parentId = manifest.dependsOn.find((dependencyId) => nodesById.has(dependencyId));
    if (parentId === undefined) continue;
    parentById.set(manifest.id, parentId);
  }

  const roots: ManifestPlanNode[] = [];

  for (const manifest of manifests) {
    const node = nodesById.get(manifest.id);
    if (node === undefined) continue;

    const parentId = parentById.get(manifest.id);
    if (parentId === undefined) {
      roots.push(node);
      continue;
    }

    const parent = nodesById.get(parentId);
    if (parent === undefined) {
      roots.push(node);
      continue;
    }

    parent.children.push(node);
  }

  return roots;
}

function sortManifestsByDependencies(
  manifests: readonly CompiledManifestDto[],
): readonly CompiledManifestDto[] {
  const byId = new Map(
    manifests.map((manifest) => [manifest.id, manifest] as const),
  );
  const normalizedManifests = manifests.map((manifest) => ({
    ...manifest,
    dependsOn: resolveManifestDependencies(manifest, byId),
  }));
  const normalizedById = new Map(
    normalizedManifests.map((manifest) => [manifest.id, manifest] as const),
  );
  const temporary = new Set<ManifestId>();
  const permanent = new Set<ManifestId>();
  const sorted: CompiledManifestDto[] = [];

  for (const manifest of normalizedManifests) {
    visitManifest(manifest, normalizedById, temporary, permanent, sorted);
  }

  return sorted;
}

function resolveManifestDependencies(
  manifest: CompiledManifestDto,
  byId: ReadonlyMap<ManifestId, CompiledManifestDto>,
): ManifestId[] {
  return manifest.dependsOn.map((dependencyId) =>
    resolveManifestDependency(manifest, dependencyId, byId),
  );
}

function resolveManifestDependency(
  manifest: CompiledManifestDto,
  dependencyId: ManifestId,
  byId: ReadonlyMap<ManifestId, CompiledManifestDto>,
): ManifestId {
  const matches = uniqueManifestIds([
    exactDependencyCandidate(dependencyId, byId),
    ...relativeDependencyCandidates(manifest, dependencyId, byId),
  ]);

  if (matches.length === 1) {
    const match = matches[0];
    if (match === undefined) {
      throw new UnexpectedEmptyDependencyMatchError(manifest.id, dependencyId);
    }
    return match;
  }

  if (matches.length === 0) {
    throw new ManifestDependencyMissingError(manifest.id, dependencyId);
  }

  throw new ManifestDependencyAmbiguousError(manifest.id, dependencyId, matches);
}

function exactDependencyCandidate(
  dependencyId: ManifestId,
  byId: ReadonlyMap<ManifestId, CompiledManifestDto>,
): ManifestId | null {
  if (!byId.has(dependencyId)) return null;

  return dependencyId;
}

function relativeDependencyCandidates(
  manifest: CompiledManifestDto,
  dependencyId: ManifestId,
  byId: ReadonlyMap<ManifestId, CompiledManifestDto>,
): readonly (ManifestId | null)[] {
  const namespace = manifest.id.split(".").slice(0, -1);
  const candidates: (ManifestId | null)[] = [];

  for (let length = namespace.length; length >= 0; length -= 1) {
    const candidate = toManifestId([...namespace.slice(0, length), dependencyId].join("."));
    candidates.push(byId.has(candidate) ? candidate : null);
  }

  return candidates;
}

function uniqueManifestIds(
  candidates: readonly (ManifestId | null)[],
): ManifestId[] {
  const unique = new Set<ManifestId>();

  for (const candidate of candidates) {
    if (candidate === null) continue;
    unique.add(candidate);
  }

  return [...unique];
}

function visitManifest(
  manifest: CompiledManifestDto,
  byId: ReadonlyMap<ManifestId, CompiledManifestDto>,
  temporary: Set<ManifestId>,
  permanent: Set<ManifestId>,
  sorted: CompiledManifestDto[],
): void {
  if (permanent.has(manifest.id)) return;
  if (temporary.has(manifest.id)) {
    throw new ManifestDependencyCycleError(manifest.id);
  }

  temporary.add(manifest.id);

  for (const dependencyId of manifest.dependsOn) {
    const dependency = byId.get(dependencyId);
    if (!dependency) {
      throw new ManifestDependencyMissingError(manifest.id, dependencyId);
    }

    visitManifest(dependency, byId, temporary, permanent, sorted);
  }

  temporary.delete(manifest.id);
  permanent.add(manifest.id);
  sorted.push(manifest);
}

function toManifestId(value: string): ManifestId {
  const id = value.trim();
  if (id.length === 0) {
    throw new EmptyManifestIdError();
  }

  return id as ManifestId;
}

