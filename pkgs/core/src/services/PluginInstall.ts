// PluginInstall.ts
//
// Orchestrates the plugin install transaction. Remote sources are fetched into
// the plugin cache before `.boxfilesrc` changes, so a recorded npm/git plugin
// always points at an artifact the loader can consume later. File sources skip
// caching and are only resolved enough to prove the local path is usable.
//
// If `.boxfilesrc` cannot be written after cache population, the error includes
// the populated cache path because manual repair may be needed to remove stale
// cache state.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { BoxfilesRcParseError, BoxfilesRcReadError, BoxfilesRcValidationError } from "../exceptions/config";
import { BoxfilesRcConfigDTO, readBoxfilesRcConfig, type BoxfilesRcConfigDto } from "./Config/index";
import { resolveFilePluginSource } from "./FilePluginResolver";
import { installGitPluginSource } from "./GitPluginInstaller";
import { installNpmPluginSource } from "./NpmPluginInstaller";
import { getPluginCacheEntry, type PluginCacheRootOptions } from "./PluginCache";
import { parsePluginSource, type FilePluginSource, type GitPluginSource, type NpmPluginSource, type ParsedPluginSource } from "./PluginSources";
import { pluginReproducibilityWarning, type PluginReproducibilityWarning } from "./PluginWarnings";

export type PluginInstallFileSystem = {
  readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
  readonly writeFile: (path: string, data: string) => Promise<void>;
  readonly mkdir: (path: string, options?: { readonly recursive?: boolean }) => Promise<void>;
};

export type PluginInstallDependencies = {
  readonly installNpm?: (source: NpmPluginSource) => Promise<unknown>;
  readonly installGit?: (source: GitPluginSource) => Promise<unknown>;
  readonly resolveFile?: (source: FilePluginSource, options: { readonly configPath: string }) => Promise<unknown>;
  readonly cache?: PluginCacheRootOptions;
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
  readonly warning: PluginReproducibilityWarning;
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

  // Mutation order matters: validate/fetch the artifact first, then record the
  // declaration. Reversing this can leave `.boxfilesrc` pointing at a plugin
  // cache entry that was never populated.

  await validateAndPopulateCache(source, configPath, options);
  await writePluginDeclarationWithDiagnostics(configPath, id, sourceText, source, config, fs, options.cache);

  return { id, source: sourceText, kind: source.kind, configPath, warning: pluginReproducibilityWarning(id, sourceText) };
}

/**
 * Populates cache state required by future planning/loading without mutating
 * project files. npm/git sources materialize into cache; file sources only
 * resolve against the config path because local plugin paths are intentionally
 * never copied into cache.
 */
async function validateAndPopulateCache(
  source: ParsedPluginSource,
  configPath: string,
  dependencies: PluginInstallDependencies,
): Promise<void> {
  if (source.kind === "npm") {
    if (dependencies.installNpm !== undefined) {
      await dependencies.installNpm(source);
      return;
    }
    await installNpmPluginSource(source, dependencies.cache);
    return;
  }

  if (source.kind === "git") {
    if (dependencies.installGit !== undefined) {
      await dependencies.installGit(source);
      return;
    }
    await installGitPluginSource(source, dependencies.cache);
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

/**
 * Writes `.boxfilesrc` after cache population and turns late write failures
 * into repairable diagnostics. At this point remote plugin bytes may already
 * exist on disk, so the caller needs the cache path, not a generic JSON error.
 */
async function writePluginDeclarationWithDiagnostics(
  configPath: string,
  id: string,
  sourceText: string,
  source: ParsedPluginSource,
  config: Readonly<Record<string, unknown>>,
  fs: PluginInstallFileSystem,
  cacheOptions: PluginCacheRootOptions | undefined,
): Promise<void> {
  try {
    await upsertPluginDeclaration(configPath, id, sourceText, config, fs);
  } catch (error) {
    const cacheEntry = getPluginCacheEntry(source, cacheOptions);
    if (cacheEntry === null) throw error;
    throw new PluginInstallError(
      `Failed to update .boxfilesrc after populating plugin cache at ${cacheEntry.path}. Repair by removing that cache directory or rerunning boxfiles plugin install. Cause: ${formatUnknownError(error)}`,
    );
  }
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
  try {
    return configDtoToWritableConfig(await readBoxfilesRcConfig(configPath, { fs }));
  } catch (error) {
    if (error instanceof BoxfilesRcParseError) {
      throw new PluginInstallError(`Unable to parse .boxfilesrc as JSON: ${formatUnknownError(error.cause)}`);
    }

    if (error instanceof BoxfilesRcReadError) {
      throw error.cause;
    }

    if (error instanceof BoxfilesRcValidationError && !isPlainObject(error.value)) {
      throw new PluginInstallError(".boxfilesrc must contain a JSON object.");
    }

    throw error;
  }
}

function configDtoToWritableConfig(config: BoxfilesRcConfigDto): Readonly<Record<string, unknown>> {
  const plugins = Object.fromEntries(config.plugins.map((plugin) => [plugin.name, plugin.source]));
  if (config.settings === undefined && config.plugins.length === 0) return {};
  if (config.plugins.length === 0) return { settings: config.settings };
  if (config.settings === undefined) return { plugins };
  return { settings: config.settings, plugins };
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


function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
