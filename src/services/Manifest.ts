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
import {
    BrandedStringSchema,
    NonBlankStringSchema,
} from "../common/schema";
import type { PluginService } from "./Plugins";
import type { ContextSnapshot } from "./Context";
import type { ExecutionPlanDto } from "./Plan";


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

export const CompiledManifestSchema = Type.Object({
    id: Type.Readonly(ManifestIdSchema),
    path: Type.Readonly(NonBlankStringSchema),
    dependsOn: Type.Readonly(Type.Array(ManifestIdSchema)),
    when: Type.Readonly(Type.Optional(ConditionExpressionSchema)),
    steps: Type.Readonly(Type.Array(ResolvedUnknownStepSchema)),
});

export type CompiledManifestDto = Type.Static<typeof CompiledManifestSchema>;

export type ManifestCompileContext = {
    readonly facts: ContextSnapshot;
};

const MANIFEST_EXTENSIONS = new Set([".yaml", ".yml", ".toml"]);
const RESERVED_ROOT_MANIFESTS = new Set([
    "boxfiles.yaml",
    "boxfiles.yml",
    "boxfiles.toml",
]);

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
        const discovered = await discoverManifestPaths(
            this.rootDir,
            this.rootDir,
        );
        return [...discovered].sort((left: string, right: string) =>
            left.localeCompare(right),
        );
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
                Manifest.load(this.rootDir, manifestPath),
            ),
        );
        return manifests.map((manifest) => this.compileManifest(manifest));
    }

    /**
     * Compute execution ordering for compiled manifests.
     * Provider planning is not wired until plugin provider plan/apply contracts are finalized.
     */
    async plan(
        context: ManifestCompileContext = { facts: {} },
    ): Promise<ExecutionPlanDto> {
        const manifests = await this.compile(context);
        const orderedManifests = sortManifestsByDependencies(manifests);

        return {
            manifests: [...orderedManifests],
            actions: [],
        };
    }

    private compileManifest(manifest: Manifest): CompiledManifestDto {
        const parsed = manifest.parse();
        const manifestId = manifest.id;
        const steps = parsed.steps.map((step, index) =>
            this.resolveStep(manifestId, step, index),
        );

        return {
            id: manifestId,
            path: manifest.path,
            dependsOn: parsed.dependsOn ?? [],
            when: parsed.when,
            steps,
        };
    }

    private resolveStep(
        manifestId: ManifestId,
        step: ManifestStepDto,
        index: number,
    ): ResolvedStep<unknown> {
        const provider = this.pluginService.plugins[step.uses];
        if (!provider) {
            throw new Error(
                `No provider registered for action kind: ${step.uses}`,
            );
        }

        const validation = provider.validate(step.with ?? {});
        if (!validation.success) {
            throw new Error(
                `Invalid config for action kind ${step.uses}: ${validation.errors.join(", ")}`,
            );
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
    ): Promise<Manifest> {
        const content = await fs.readFile(manifestPath, "utf-8");
        return new Manifest(rootDir, manifestPath, content);
    }

    parse(): ManifestDto {
        const raw = parseManifestContent(this.path, this.content);
        return ManifestDTO.parse(raw);
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

async function discoverManifestPaths(
    rootDir: string,
    currentDir: string,
): Promise<readonly string[]> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const discovered: string[] = [];

    for (const entry of entries) {
        const entryPath = path.join(currentDir, entry.name);
        const isDir = entry.isDirectory();

        if (isDir && entry.name === "files") {
            continue;
        }

        if (isDir) {
            discovered.push(
                ...(await discoverManifestPaths(rootDir, entryPath)),
            );
            continue;
        }

        //TODO: allow symlinks but ensure we don't get into infinite loops. For now, just skip them.
        if (!entry.isFile()) continue;

        if (!isManifestPath(rootDir, entryPath)) continue;

        discovered.push(entryPath);
    }

    return discovered;
}

/**
 * A manifest file path is any path that includes a `files` directory segment, which should be excluded from manifest discovery and parsing.
 */
async function isFileAssetPath(filePath: string): Promise<boolean> {
    const isDir = await fs.stat(filePath);
    const parentPath = isDir.isDirectory() ? filePath : path.dirname(filePath);

    return parentPath.split(path.sep).includes("files");
}

async function isManifestPath(
    rootDir: string,
    manifestPath: string,
): Promise<boolean> {
    // if it's not a yaml or toml file, it's not a manifest
    const extension = path.extname(manifestPath);
    if (!MANIFEST_EXTENSIONS.has(extension)) return false;

    // if it's under a files directory, it's not a manifest
    const relativePath = path.relative(rootDir, manifestPath);
    if (await isFileAssetPath(manifestPath)) return false;

    // at this point, if it's not at the root, it's a manifest.
    const isRoot = path.dirname(relativePath) === ".";
    if (!isRoot) return true;

    // If it is at the root, it must not be a reserved filename to be a manifest.
    // if it's a special filename at the root, it's not a manifest
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

function sortManifestsByDependencies(
    manifests: readonly CompiledManifestDto[],
): readonly CompiledManifestDto[] {
    const byId = new Map(
        manifests.map((manifest) => [manifest.id, manifest] as const),
    );
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
        throw new Error(
            `Manifest dependency cycle detected at: ${manifest.id}`,
        );
    }

    temporary.add(manifest.id);

    for (const dependencyId of manifest.dependsOn) {
        const dependency = byId.get(dependencyId);
        if (!dependency) {
            throw new Error(
                `Manifest ${manifest.id} depends on missing manifest: ${dependencyId}`,
            );
        }

        visitManifest(dependency, byId, temporary, permanent, sorted);
    }

    temporary.delete(manifest.id);
    permanent.add(manifest.id);
    sorted.push(manifest);
}
