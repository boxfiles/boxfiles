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
import Schema from "typebox/schema";
import { BrandedStringSchema, NonBlankStringSchema } from "../common/schema";
import type { PluginRegistry } from "./Plugin";
import type { ContextSnapshot } from "./Context";
import type { ExecutionPlanDto } from "./Plan";
import {
  EmptyManifestIdError,
  EmptyStepIdError,
  InvalidActionConfigError,
  ManifestContentParseError,
  ManifestIdDerivationError,
  ManifestSchemaValidationError,
  type TypeboxValidationErrorLike,
  NoProviderRegisteredError,
  UnsupportedManifestExtensionError,
} from "../exceptions/manifest";

export const ManifestIdSchema = BrandedStringSchema<"ManifestId">();
export const StepIdSchema = BrandedStringSchema<"StepId">();
export const ActionKindSchema = BrandedStringSchema<"ActionKind">();
export const ConditionExpressionSchema =
  BrandedStringSchema<"ConditionExpressionDto">();

export type ManifestId = Type.Static<typeof ManifestIdSchema>;
export type StepId = Type.Static<typeof StepIdSchema>;
export type ActionKind = Type.Static<typeof ActionKindSchema>;
export type ConditionExpressionDto = Type.Static<
  typeof ConditionExpressionSchema
>;

export const ManifestStepSchema = Type.Object({
  id: Type.Readonly(Type.Optional(StepIdSchema)),
  uses: Type.Readonly(ActionKindSchema),
  with: Type.Readonly(Type.Optional(Type.Unknown())),
  when: Type.Readonly(Type.Optional(ConditionExpressionSchema)),
});

export const ManifestSchema = Type.Object({
  dependsOn: Type.Readonly(Type.Optional(Type.Array(ManifestIdSchema))),
  when: Type.Readonly(Type.Optional(ConditionExpressionSchema)),
  steps: Type.Readonly(Type.Array(ManifestStepSchema)),
});

export type ManifestStepDto = Type.Static<typeof ManifestStepSchema>;
export type ManifestDto = Type.Static<typeof ManifestSchema>;

const ManifestDtoParser = Schema.Compile(ManifestSchema);

export const ManifestDTO = {
  parse(raw: unknown): ManifestDto {
    return ManifestDtoParser.Parse(raw);
  },
};

export const ResolvedStepSchema = <TConfigSchema extends Type.TSchema>(
  configSchema: TConfigSchema,
) =>
  Type.Object({
    id: Type.Readonly(StepIdSchema),
    manifestId: Type.Readonly(ManifestIdSchema),
    uses: Type.Readonly(ActionKindSchema),
    config: Type.Readonly(configSchema),
    when: Type.Readonly(Type.Optional(ConditionExpressionSchema)),
  });

export const ResolvedUnknownStepSchema = ResolvedStepSchema(Type.Unknown());

type ResolvedStepBase = Type.Static<typeof ResolvedUnknownStepSchema>;

export type ResolvedStep<TConfig = unknown> = Omit<
  ResolvedStepBase,
  "config"
> & {
  readonly config: TConfig;
};

export const ManifestContextSchema = Type.Object({
  id: Type.Readonly(ManifestIdSchema),
  path: Type.Readonly(NonBlankStringSchema),
  dir: Type.Readonly(NonBlankStringSchema),
  filesDir: Type.Readonly(NonBlankStringSchema),
});

export type ManifestContextDto = Type.Static<typeof ManifestContextSchema>;

export const CompiledManifestSchema = Type.Object({
  id: Type.Readonly(ManifestIdSchema),
  path: Type.Readonly(NonBlankStringSchema),
  manifest: Type.Readonly(ManifestContextSchema),
  dependsOn: Type.Readonly(Type.Array(ManifestIdSchema)),
  when: Type.Readonly(Type.Optional(ConditionExpressionSchema)),
  steps: Type.Readonly(Type.Array(ResolvedUnknownStepSchema)),
});

export type CompiledManifestDto = Type.Static<typeof CompiledManifestSchema>;

export type ManifestCompileContext = {
  readonly facts: ContextSnapshot;
};

const MANIFEST_EXTENSIONS = new Set([".yaml", ".yml", ".toml"]);
const BOXFILES_CONFIG_PATTERN = /^\.boxfilesrc\.(json|ya?ml|toml)$/;
const IGNORED_DISCOVERY_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
]);

export type ManifestDirectoryEntry = {
  readonly name: string;
  isDirectory(): boolean;
  isFile(): boolean;
};

export type ManifestFileStat = {
  isDirectory(): boolean;
};

export type ManifestFileSystem = {
  readonly readFile: (filePath: string, encoding: "utf-8") => Promise<string>;
  readonly readdir: (
    dirPath: string,
    options: { readonly withFileTypes: true },
  ) => Promise<readonly ManifestDirectoryEntry[]>;
  readonly stat: (filePath: string) => Promise<ManifestFileStat>;
};

const nodeManifestFileSystem: ManifestFileSystem = {
  readFile: async (filePath, encoding) => await fs.readFile(filePath, encoding),
  readdir: async (dirPath, options) => await fs.readdir(dirPath, options),
  stat: async (filePath) => await fs.stat(filePath),
};
export class ManifestService {
  constructor(
    public readonly rootDir: string,
    private readonly pluginRegistry: PluginRegistry,
    private readonly fileSystem: ManifestFileSystem = nodeManifestFileSystem,
  ) {}

  /**
   * Find all manifests recursively under rootDir.
   * Excludes fixture/build directories, any path under a `files` directory, and `.boxfilesrc.*` config files anywhere.
   */
  async discover(): Promise<readonly string[]> {
    const discovered = await discoverManifestPaths(
      this.rootDir,
      this.rootDir,
      this.fileSystem,
    );
    return [...discovered].sort((left: string, right: string) =>
      left.localeCompare(right),
    );
  }

  async discoverContexts(): Promise<readonly ManifestContextDto[]> {
    const manifestPaths = await this.discover();
    return manifestPaths.map((manifestPath) => {
      const manifestId = manifestIdFromPath(this.rootDir, manifestPath);
      return manifestContextFromPath(this.rootDir, manifestPath, manifestId);
    });
  }

  /**
   * Parse manifests and validate each step config against the matching plugin/provider.
   * Template interpolation is intentionally not implemented yet; this compiles structural DTOs only.
   */
  async compile(
    _context: ManifestCompileContext = { facts: {} },
  ): Promise<readonly CompiledManifestDto[]> {
    const paths = await this.discover();
    const manifests = await Promise.all(
      paths.map((manifestPath) =>
        Manifest.load(this.rootDir, manifestPath, this.fileSystem),
      ),
    );
    return manifests.map((manifest) => this.compileManifest(manifest));
  }

  /**
   * Compute execution ordering for compiled manifests and provider action plans.
   */
  async plan(
    context: ManifestCompileContext = { facts: {} },
  ): Promise<ExecutionPlanDto> {
    const manifests = await this.compile(context);
    const { PlanService } = await import("./Plan");
    const planService = new PlanService(
      this.rootDir,
      this.pluginRegistry,
      manifests,
      context,
    );

    return planService.compile();
  }

  private compileManifest(manifest: Manifest): CompiledManifestDto {
    const parsed = manifest.parse();
    const manifestId = manifest.id;
    const context = manifestContextFromPath(
      this.rootDir,
      manifest.path,
      manifestId,
    );
    const steps = parsed.steps.map((step, index) =>
      this.resolveStep(manifest, step, index),
    );

    return {
      id: manifestId,
      path: manifest.path,
      manifest: context,
      dependsOn: parsed.dependsOn ?? [],
      when: parsed.when,
      steps,
    };
  }

  private resolveStep(
    manifest: Manifest,
    step: ManifestStepDto,
    index: number,
  ): ResolvedStep<unknown> {
    const provider = this.pluginRegistry.getActionProvider(step.uses);
    if (!provider) {
      throw new NoProviderRegisteredError(manifest.id, step.uses);
    }

    const validation = provider.validate(step.with ?? {});
    if (!validation.success) {
      throw new InvalidActionConfigError(
        manifest.id,
        step.uses,
        validation.errors,
      );
    }

    return {
      id: step.id ?? toStepId(`${manifest.id}.${index + 1}`),
      manifestId: manifest.id,
      uses: step.uses,
      config: validation.value,
      when: step.when,
    };
  }
}

export class Manifest {
  public readonly id: ManifestId;

  constructor(
    public readonly rootDir: string,
    public readonly path: string,
    public readonly content: string,
  ) {
    this.id = manifestIdFromPath(rootDir, path);
  }

  static async load(
    rootDir: string,
    manifestPath: string,
    fileSystem: ManifestFileSystem = nodeManifestFileSystem,
  ): Promise<Manifest> {
    const content = await fileSystem.readFile(manifestPath, "utf-8");
    return new Manifest(rootDir, manifestPath, content);
  }

  parse(): ManifestDto {
    let raw: unknown;

    try {
      raw = parseManifestContent(this.path, this.content);
    } catch (error) {
      if (error instanceof UnsupportedManifestExtensionError) {
        throw error;
      }

      throw new ManifestContentParseError(this.path, error);
    }

    try {
      return ManifestDTO.parse(raw);
    } catch (error) {
      if (isTypeboxValidationErrorLike(error)) {
        throw new ManifestSchemaValidationError(this.path, raw, error);
      }

      throw new ManifestContentParseError(this.path, error);
    }
  }

  dependencies(): readonly ManifestId[] {
    return this.parse().dependsOn ?? [];
  }
}

export function manifestIdFromPath(
  rootDir: string,
  manifestPath: string,
): ManifestId {
  const relativePath = path.relative(rootDir, manifestPath);
  const normalized = relativePath.split(path.sep).join("/");
  const parsed = path.parse(normalized);
  const withoutExtension = path
    .join(parsed.dir, parsed.name)
    .split(path.sep)
    .join("/");
  const id = withoutExtension.split("/").filter(Boolean).join(".");

  if (id.length === 0) {
    throw new ManifestIdDerivationError(manifestPath);
  }

  return toManifestId(id);
}

function toManifestId(value: string): ManifestId {
  const id = value.trim();
  if (id.length === 0) {
    throw new EmptyManifestIdError();
  }

  return id as ManifestId;
}

function toStepId(value: string): StepId {
  const id = value.trim();
  if (id.length === 0) {
    throw new EmptyStepIdError();
  }

  return id as StepId;
}

function manifestContextFromPath(
  rootDir: string,
  manifestPath: string,
  manifestId: ManifestId,
): ManifestContextDto {
  const relativePath = path
    .relative(rootDir, manifestPath)
    .split(path.sep)
    .join("/");
  const relativeDir = path.dirname(relativePath).split(path.sep).join("/");
  const dir = relativeDir === "." ? "." : relativeDir;

  return {
    id: manifestId,
    path: relativePath,
    dir,
    filesDir: dir === "." ? "files" : `${dir}/files`,
  };
}

async function discoverManifestPaths(
  rootDir: string,
  currentDir: string,
  fileSystem: ManifestFileSystem,
): Promise<readonly string[]> {
  const entries = await fileSystem.readdir(currentDir, { withFileTypes: true });
  const discovered: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const isDir = entry.isDirectory();

    if (isIgnoredDiscoveryDirectory(entry.name)) {
      continue;
    }

    if (isDir) {
      discovered.push(
        ...(await discoverManifestPaths(rootDir, entryPath, fileSystem)),
      );
      continue;
    }

    //TODO: allow symlinks but ensure we don't get into infinite loops. For now, just skip them.
    if (!entry.isFile()) continue;

    if (!(await isManifestPath(rootDir, entryPath, fileSystem))) continue;

    discovered.push(entryPath);
  }

  return discovered;
}

/**
 * A manifest file path is any path that includes a `files` directory segment, which should be excluded from manifest discovery and parsing.
 */
async function isFileAssetPath(
  filePath: string,
  fileSystem: ManifestFileSystem,
): Promise<boolean> {
  const isDir = await fileSystem.stat(filePath);
  const parentPath = isDir.isDirectory() ? filePath : path.dirname(filePath);

  return parentPath.split(path.sep).includes("files");
}

async function isManifestPath(
  rootDir: string,
  manifestPath: string,
  fileSystem: ManifestFileSystem,
): Promise<boolean> {
  // if it's not a yaml or toml file, it's not a manifest
  const extension = path.extname(manifestPath);
  if (!MANIFEST_EXTENSIONS.has(extension)) return false;

  // if it's under a files directory, it's not a manifest
  const relativePath = path.relative(rootDir, manifestPath);
  if (await isFileAssetPath(manifestPath, fileSystem)) return false;

  // config files are not manifests, anywhere in the tree.
  if (BOXFILES_CONFIG_PATTERN.test(path.basename(relativePath))) return false;

  return true;
}

function isIgnoredDiscoveryDirectory(entryName: string): boolean {
  if (entryName.startsWith(".")) return true;

  return IGNORED_DISCOVERY_DIRECTORIES.has(entryName);
}

function isTypeboxValidationErrorLike(
  error: unknown,
): error is TypeboxValidationErrorLike {
  if (!error || typeof error !== "object" || Array.isArray(error)) return false;
  if (!("schema" in error)) return false;
  if (!("value" in error)) return false;
  if (!("errors" in error)) return false;

  const errors = (error as { readonly errors: unknown }).errors;
  return Array.isArray(errors);
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
      throw new UnsupportedManifestExtensionError(manifestPath);
  }
}
