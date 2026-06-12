// PluginLoader.ts
//
// Loads plugins already declared in `.boxfilesrc` and registers their modules
// with PluginService. Remote plugin declarations resolve through the plugin
// cache; file declarations resolve directly against the local path.
//
// Loader does no network or install work. Missing cache entries are reported as
// load errors so users run install/repair instead of planning against live npm
// or git state.
import { access, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BoxfilesRcParseError, BoxfilesRcReadError } from "../exceptions/config";
import { readBoxfilesRcConfig, type BoxfilesRcConfigDto } from "./Config";
import { resolveFilePluginSource, resolvePluginEntryPath, type FilePluginResolverFileSystem } from "./FilePluginResolver";
import { getPluginCacheEntry, type PluginCacheRootOptions } from "./PluginCache";
import { parsePluginSource, type ParsedPluginSource } from "./PluginSources";
import { normalizePluginModule, type PluginService, type PluginSource } from "./Plugins";

export type PluginLoaderFileSystem = FilePluginResolverFileSystem & {
  readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
};

export type PluginModuleImporter = (specifier: string) => Promise<unknown>;

export type LoadInstalledPluginsOptions = {
  readonly rootDir: string;
  readonly pluginService: PluginService;
  readonly fs?: PluginLoaderFileSystem;
  readonly cache?: PluginCacheRootOptions;
  readonly importModule?: PluginModuleImporter;
};

export type LoadedPluginModuleDto = {
  readonly name: string;
  readonly source: string;
  readonly kind: ParsedPluginSource["kind"];
  readonly entryPath: string;
};

export class PluginLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginLoadError";
  }
}

const nodeFileSystem: PluginLoaderFileSystem = {
  stat,
  readFile,
  access,
};

/**
 * Registers every plugin declared in `.boxfilesrc` using artifacts already on
 * disk. This is runtime integration, not installation: npm/git sources must be
 * present in cache before this function runs.
 */
 export async function loadInstalledPlugins(
  options: LoadInstalledPluginsOptions,
): Promise<readonly LoadedPluginModuleDto[]> {
  const fs = options.fs ?? nodeFileSystem;
  const configPath = join(options.rootDir, ".boxfilesrc");
  const config = await readConfig(configPath, fs);
  const loaded: LoadedPluginModuleDto[] = [];

  for (const declaration of config.plugins) {
    const source = parsePluginSource(declaration.source);
    const entryPath = await resolvePluginDeclarationEntryPath(source, configPath, fs, options.cache);
    const moduleValue = await importPluginModule(entryPath, options.importModule);
    options.pluginService.registerPlugin(normalizePluginModule(moduleValue), pluginSourceFor(source));
    loaded.push({
      name: declaration.name,
      source: declaration.source,
      kind: source.kind,
      entryPath,
    });
  }

  return loaded;
}

async function readConfig(
  configPath: string,
  fs: PluginLoaderFileSystem,
): Promise<BoxfilesRcConfigDto> {
  try {
    return await readBoxfilesRcConfig(configPath, { fs });
  } catch (error) {
    if (error instanceof BoxfilesRcReadError) {
      throw new PluginLoadError(`Unable to read .boxfilesrc: ${formatUnknownError(error.cause)}`);
    }

    if (error instanceof BoxfilesRcParseError) {
      throw new PluginLoadError(`Unable to parse .boxfilesrc as JSON: ${formatUnknownError(error.cause)}`);
    }

    throw error;
  }
}

async function resolvePluginDeclarationEntryPath(
  source: ParsedPluginSource,
  configPath: string,
  fs: PluginLoaderFileSystem,
  cacheOptions: PluginCacheRootOptions | undefined,
): Promise<string> {
  if (source.kind === "file") {
    // File plugins deliberately bypass cache. They are local extension points,
    // so planning loads the current path and reproducibility warnings carry the
    // portability risk.
    const artifact = await resolveFilePluginSource(source, { configPath, fs });
    return artifact.entryPath;
  }

  const cacheEntry = getPluginCacheEntry(source, cacheOptions);
  // Remote plugins must resolve to cache entries populated by install. Do not
  // fall back to network here; that would make planning non-reproducible.
  if (cacheEntry === null) {
    throw new PluginLoadError(`Plugin source ${source.kind} did not produce a cache entry.`);
  }

  await assertCachedPluginDirectory(cacheEntry.path, fs);
  return await resolvePluginEntryPath(fs, cacheEntry.path);
}

async function assertCachedPluginDirectory(
  cachePath: string,
  fs: PluginLoaderFileSystem,
): Promise<void> {
  let cacheStat: { readonly isDirectory: () => boolean };
  try {
    cacheStat = await fs.stat(cachePath);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT") || hasErrorCode(error, "ENOTDIR")) {
      throw new PluginLoadError(`Installed plugin cache entry is missing: ${cachePath}`);
    }
    throw new PluginLoadError(`Unable to inspect plugin cache entry ${cachePath}: ${formatUnknownError(error)}`);
  }

  if (!cacheStat.isDirectory()) {
    throw new PluginLoadError(`Installed plugin cache entry is not a directory: ${cachePath}`);
  }
}

async function importPluginModule(
  entryPath: string,
  importer: PluginModuleImporter | undefined,
): Promise<unknown> {
  const specifier = pathToFileURL(entryPath).href;
  return await (importer ?? defaultImportModule)(specifier);
}

const defaultImportModule: PluginModuleImporter = async (specifier) => await import(specifier);

function pluginSourceFor(source: ParsedPluginSource): PluginSource {
  return source.kind;
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
