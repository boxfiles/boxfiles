/**
 * Manifest service/model.
 *
 * Discovers yaml/toml manifest files, excludes any path under a `files` dir,
 * parses manifests into DTOs, validates step configs against registered plugins,
 * and derives deterministic manifest ids from paths.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import Type from "typebox";
import type { PluginService } from "./Plugins";
import type { ContextSnapshot } from "./Context";

export type ManifestId = string & { readonly __brand: "ManifestId" };
export type StepId = string & { readonly __brand: "StepId" };
export type ActionKind = string & { readonly __brand: "ActionKind" };
export type ConditionExpressionDto = string & { readonly __brand: "ConditionExpressionDto" };

export type ManifestStepDto = {
  readonly id?: StepId;
  readonly uses: ActionKind;
  readonly with?: unknown;
  readonly when?: ConditionExpressionDto;
};

export type ManifestDto = {
  readonly dependsOn?: readonly ManifestId[];
  readonly when?: ConditionExpressionDto;
  readonly steps: readonly ManifestStepDto[];
};

export type ResolvedStep<TConfig> = {
  readonly id: StepId;
  readonly manifestId: ManifestId;
  readonly uses: ActionKind;
  readonly config: TConfig;
  readonly when?: ConditionExpressionDto;
};

export type CompiledManifestDto = {
  readonly id: ManifestId;
  readonly path: string;
  readonly dependsOn: readonly ManifestId[];
  readonly when?: ConditionExpressionDto;
  readonly steps: readonly ResolvedStep<unknown>[];
};

export type ActionSafetyDto = {
  readonly idempotent: boolean;
  readonly unsafe: boolean;
  readonly requiresConfirmation: boolean;
  readonly reason?: string;
};

export type PlannedChangeDto = {
  readonly target: string;
  readonly operation: "create" | "update" | "delete" | "execute" | "noop";
  readonly before?: unknown;
  readonly after?: unknown;
  readonly message?: string;
};

export type ActionPlanDto = {
  readonly actionId: StepId;
  readonly manifestId: ManifestId;
  readonly kind: ActionKind;
  readonly summary: string;
  readonly safety: ActionSafetyDto;
  readonly changes: readonly PlannedChangeDto[];
};

export type ExecutionPlanDto = {
  readonly manifests: readonly CompiledManifestDto[];
  readonly actions: readonly ActionPlanDto[];
};

export type ManifestCompileContext = {
  readonly facts: ContextSnapshot;
};

export const ManifestStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  uses: Type.String(),
  with: Type.Optional(Type.Unknown()),
  when: Type.Optional(Type.String()),
});

export const ManifestSchema = Type.Object({
  dependsOn: Type.Optional(Type.Array(Type.String())),
  when: Type.Optional(Type.String()),
  steps: Type.Array(ManifestStepSchema),
});

const MANIFEST_EXTENSIONS = new Set([".yaml", ".yml", ".toml"]);
const RESERVED_ROOT_MANIFESTS = new Set(["boxfiles.yaml", "boxfiles.yml", "boxfiles.toml"]);

export class ManifestService {
  constructor(
    public readonly rootDir: string,
    private readonly pluginService: PluginService,
  ) {}

  /**
   * Find all manifests recursively under rootDir.
   * Excludes any path under a `files` directory and reserved root `boxfiles.*` files.
   */
  async discover(): Promise<readonly string[]> {
    const discovered = await discoverManifestPaths(this.rootDir, this.rootDir);
    return [...discovered].sort((left: string, right: string) => left.localeCompare(right));
  }

  /**
   * Parse manifests and validate each step config against the matching plugin/provider.
   * Template interpolation is intentionally not implemented yet; this compiles structural DTOs only.
   */
  async compile(_context: ManifestCompileContext = { facts: {} }): Promise<readonly CompiledManifestDto[]> {
    const paths = await this.discover();
    const manifests = await Promise.all(paths.map((manifestPath) => Manifest.load(this.rootDir, manifestPath)));
    return manifests.map((manifest) => this.compileManifest(manifest));
  }

  /**
   * Compute execution ordering for compiled manifests.
   * Provider planning is not wired until plugin provider plan/apply contracts are finalized.
   */
  async plan(context: ManifestCompileContext = { facts: {} }): Promise<ExecutionPlanDto> {
    const manifests = await this.compile(context);
    const orderedManifests = sortManifestsByDependencies(manifests);

    return {
      manifests: orderedManifests,
      actions: [],
    };
  }

  private compileManifest(manifest: Manifest): CompiledManifestDto {
    const parsed = manifest.parse();
    const manifestId = manifest.id();
    const steps = parsed.steps.map((step, index) => this.resolveStep(manifestId, step, index));

    return {
      id: manifestId,
      path: manifest.path,
      dependsOn: parsed.dependsOn ?? [],
      when: parsed.when,
      steps,
    };
  }

  private resolveStep(manifestId: ManifestId, step: ManifestStepDto, index: number): ResolvedStep<unknown> {
    const provider = this.pluginService.plugins[step.uses];
    if (!provider) {
      throw new Error(`No provider registered for action kind: ${step.uses}`);
    }

    const validation = provider.validate(step.with ?? {});
    if (!validation.success) {
      throw new Error(`Invalid config for action kind ${step.uses}: ${validation.errors.join(", ")}`);
    }

    return {
      id: step.id ?? toStepId(`${manifestId}.${index + 1}`),
      manifestId,
      uses: step.uses,
      config: validation.value,
      when: step.when,
    };
  }
}

export class Manifest {
  constructor(
    public readonly rootDir: string,
    public readonly path: string,
    public readonly content: string,
  ) {}

  static async load(rootDir: string, manifestPath: string): Promise<Manifest> {
    const content = await fs.readFile(manifestPath, "utf-8");
    return new Manifest(rootDir, manifestPath, content);
  }

  id(): ManifestId {
    return manifestIdFromPath(this.rootDir, this.path);
  }

  parse(): ManifestDto {
    const raw = parseManifestContent(this.path, this.content);
    return toManifestDto(raw, this.path);
  }

  dependencies(): readonly ManifestId[] {
    return this.parse().dependsOn ?? [];
  }
}

export function manifestIdFromPath(rootDir: string, manifestPath: string): ManifestId {
  const relativePath = path.relative(rootDir, manifestPath);
  const normalized = relativePath.split(path.sep).join("/");
  const parsed = path.parse(normalized);
  const withoutExtension = path.join(parsed.dir, parsed.name).split(path.sep).join("/");
  const id = withoutExtension.split("/").filter(Boolean).join(".");

  if (id.length === 0) {
    throw new Error(`Cannot derive manifest id from path: ${manifestPath}`);
  }

  return toManifestId(id);
}

function toManifestId(value: string): ManifestId {
  const id = value.trim();
  if (id.length === 0) {
    throw new Error("Manifest id must not be empty");
  }

  return id as ManifestId;
}

function toStepId(value: string): StepId {
  const id = value.trim();
  if (id.length === 0) {
    throw new Error("Step id must not be empty");
  }

  return id as StepId;
}

function toActionKind(value: string): ActionKind {
  const kind = value.trim();
  if (kind.length === 0) {
    throw new Error("Action kind must not be empty");
  }

  return kind as ActionKind;
}

function toConditionExpression(value: string): ConditionExpressionDto {
  const expression = value.trim();
  if (expression.length === 0) {
    throw new Error("Condition expression must not be empty");
  }

  return expression as ConditionExpressionDto;
}

async function discoverManifestPaths(rootDir: string, currentDir: string): Promise<readonly string[]> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const discovered: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "files") continue;
      discovered.push(...(await discoverManifestPaths(rootDir, entryPath)));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!isManifestPath(rootDir, entryPath)) continue;
    discovered.push(entryPath);
  }

  return discovered;
}

function isManifestPath(rootDir: string, manifestPath: string): boolean {
  const extension = path.extname(manifestPath);
  if (!MANIFEST_EXTENSIONS.has(extension)) return false;

  const relativePath = path.relative(rootDir, manifestPath);
  if (relativePath.includes(`${path.sep}files${path.sep}`)) return false;

  const isRootFile = path.dirname(relativePath) === ".";
  if (!isRootFile) return true;

  return !RESERVED_ROOT_MANIFESTS.has(path.basename(relativePath));
}

function parseManifestContent(manifestPath: string, content: string): unknown {
  const extension = path.extname(manifestPath);

  switch (extension) {
    case ".yaml":
    case ".yml":
      return Bun.YAML.parse(content);
    case ".toml":
      return Bun.TOML.parse(content);
    default:
      throw new Error(`Unsupported manifest extension: ${extension}`);
  }
}

function toManifestDto(value: unknown, manifestPath: string): ManifestDto {
  if (!isRecord(value)) {
    throw new Error(`Manifest must be an object: ${manifestPath}`);
  }

  return {
    dependsOn: readOptionalManifestIds(value.dependsOn, manifestPath),
    when: readOptionalCondition(value.when, manifestPath),
    steps: readSteps(value.steps, manifestPath),
  };
}

function readOptionalManifestIds(value: unknown, manifestPath: string): readonly ManifestId[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`Manifest dependsOn must be an array: ${manifestPath}`);
  }

  return value.map((dependency) => {
    if (typeof dependency !== "string") {
      throw new Error(`Manifest dependsOn entries must be strings: ${manifestPath}`);
    }

    return toManifestId(dependency);
  });
}

function readOptionalCondition(value: unknown, manifestPath: string): ConditionExpressionDto | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`Manifest when must be a string: ${manifestPath}`);
  }

  return toConditionExpression(value);
}

function readSteps(value: unknown, manifestPath: string): readonly ManifestStepDto[] {
  if (!Array.isArray(value)) {
    throw new Error(`Manifest steps must be an array: ${manifestPath}`);
  }

  return value.map((step, index) => readStep(step, manifestPath, index));
}

function readStep(value: unknown, manifestPath: string, index: number): ManifestStepDto {
  if (!isRecord(value)) {
    throw new Error(`Manifest step ${index + 1} must be an object: ${manifestPath}`);
  }

  if (typeof value.uses !== "string") {
    throw new Error(`Manifest step ${index + 1} uses must be a string: ${manifestPath}`);
  }

  return {
    id: readOptionalStepId(value.id, manifestPath, index),
    uses: toActionKind(value.uses),
    with: value.with,
    when: readOptionalCondition(value.when, manifestPath),
  };
}

function readOptionalStepId(value: unknown, manifestPath: string, index: number): StepId | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`Manifest step ${index + 1} id must be a string: ${manifestPath}`);
  }

  return toStepId(value);
}

function sortManifestsByDependencies(manifests: readonly CompiledManifestDto[]): readonly CompiledManifestDto[] {
  const byId = new Map(manifests.map((manifest) => [manifest.id, manifest] as const));
  const temporary = new Set<ManifestId>();
  const permanent = new Set<ManifestId>();
  const sorted: CompiledManifestDto[] = [];

  for (const manifest of manifests) {
    visitManifest(manifest, byId, temporary, permanent, sorted);
  }

  return sorted;
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
    throw new Error(`Manifest dependency cycle detected at: ${manifest.id}`);
  }

  temporary.add(manifest.id);

  for (const dependencyId of manifest.dependsOn) {
    const dependency = byId.get(dependencyId);
    if (!dependency) {
      throw new Error(`Manifest ${manifest.id} depends on missing manifest: ${dependencyId}`);
    }

    visitManifest(dependency, byId, temporary, permanent, sorted);
  }

  temporary.delete(manifest.id);
  permanent.add(manifest.id);
  sorted.push(manifest);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
