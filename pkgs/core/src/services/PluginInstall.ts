import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { BoxfilesRcConfigDTO } from "./Config";
import { resolveFilePluginSource } from "./FilePluginResolver";
import { installGitPluginSource } from "./GitPluginInstaller";
import { installNpmPluginSource } from "./NpmPluginInstaller";
import { parsePluginSource, type FilePluginSource, type GitPluginSource, type NpmPluginSource, type ParsedPluginSource } from "./PluginSources";

export type PluginInstallFileSystem = {
  readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
  readonly writeFile: (path: string, data: string) => Promise<void>;
  readonly mkdir: (path: string, options?: { readonly recursive?: boolean }) => Promise<void>;
};

export type PluginInstallDependencies = {
  readonly installNpm?: (source: NpmPluginSource) => Promise<unknown>;
  readonly installGit?: (source: GitPluginSource) => Promise<unknown>;
  readonly resolveFile?: (source: FilePluginSource, options: { readonly configPath: string }) => Promise<unknown>;
};

export type PluginInstallOptions = PluginInstallDependencies & {
  readonly rootDir: string;
  readonly fs?: PluginInstallFileSystem;
};

export type PluginInstallResult = {
  readonly id: string;
  readonly source: string;
  readonly kind: ParsedPluginSource["kind"];
  readonly configPath: string;
};

export class PluginInstallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginInstallError";
  }
}

const nodeFileSystem: PluginInstallFileSystem = {
  readFile,
  writeFile,
  mkdir: async (path, options) => { void await mkdir(path, options); },
};

export async function installPluginDeclaration(
  id: string,
  sourceText: string,
  options: PluginInstallOptions,
): Promise<PluginInstallResult> {
  validatePluginId(id);
  const source = parsePluginSource(sourceText);
  const configPath = join(options.rootDir, ".boxfilesrc");
  const fs = options.fs ?? nodeFileSystem;
  const config = await readExistingConfig(configPath, fs);

  await validateAndPopulateCache(source, configPath, options);
  await upsertPluginDeclaration(configPath, id, sourceText, config, fs);

  return { id, source: sourceText, kind: source.kind, configPath };
}

async function validateAndPopulateCache(
  source: ParsedPluginSource,
  configPath: string,
  dependencies: PluginInstallDependencies,
): Promise<void> {
  if (source.kind === "npm") {
    await (dependencies.installNpm ?? installNpmPluginSource)(source);
    return;
  }

  if (source.kind === "git") {
    await (dependencies.installGit ?? installGitPluginSource)(source);
    return;
  }

  await (dependencies.resolveFile ?? defaultResolveFile)(source, { configPath });
}

async function defaultResolveFile(
  source: FilePluginSource,
  options: { readonly configPath: string },
): Promise<unknown> {
  return await resolveFilePluginSource(source, options);
}

async function upsertPluginDeclaration(
  configPath: string,
  id: string,
  sourceText: string,
  config: Readonly<Record<string, unknown>>,
  fs: PluginInstallFileSystem,
): Promise<void> {
  const plugins = readPluginMap(config);
  const updated = {
    ...config,
    plugins: {
      ...plugins,
      [id]: sourceText,
    },
  };

  BoxfilesRcConfigDTO.parse(updated);
  await fs.mkdir(dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(updated, null, 2)}\n`);
}

async function readExistingConfig(
  configPath: string,
  fs: PluginInstallFileSystem,
): Promise<Readonly<Record<string, unknown>>> {
  let text: string;
  try {
    text = await fs.readFile(configPath, "utf8");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return {};
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    throw new PluginInstallError(`Unable to parse .boxfilesrc as JSON: ${formatUnknownError(error)}`);
  }

  BoxfilesRcConfigDTO.parse(parsed);
  if (isPlainObject(parsed)) return parsed;
  throw new PluginInstallError(".boxfilesrc must contain a JSON object.");
}

function readPluginMap(config: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> {
  const plugins = config["plugins"];
  if (plugins === undefined) return {};
  if (!isPlainObject(plugins)) return {};

  const entries: [string, string][] = [];
  for (const [pluginId, pluginSource] of Object.entries(plugins)) {
    if (typeof pluginSource === "string") entries.push([pluginId, pluginSource]);
  }

  return Object.fromEntries(entries);
}

function validatePluginId(id: string): void {
  if (id.trim().length > 0) return;
  throw new PluginInstallError("Plugin id must be non-empty.");
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasErrorCode(value: unknown, code: string): boolean {
  return typeof value === "object"
    && value !== null
    && "code" in value
    && value.code === code;
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
