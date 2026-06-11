import { access, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BoxfilesRcConfigDTO, type BoxfilesRcConfigDto } from "./Config";
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
  let text: string;
  try {
    text = await fs.readFile(configPath, "utf8");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return BoxfilesRcConfigDTO.parse({});
    throw new PluginLoadError(`Unable to read .boxfilesrc: ${formatUnknownError(error)}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (error) {
    throw new PluginLoadError(`Unable to parse .boxfilesrc as JSON: ${formatUnknownError(error)}`);
  }

  return BoxfilesRcConfigDTO.parse(raw);
}

async function resolvePluginDeclarationEntryPath(
  source: ParsedPluginSource,
  configPath: string,
  fs: PluginLoaderFileSystem,
  cacheOptions: PluginCacheRootOptions | undefined,
): Promise<string> {
  if (source.kind === "file") {
    const artifact = await resolveFilePluginSource(source, { configPath, fs });
    return artifact.entryPath;
  }

  const cacheEntry = getPluginCacheEntry(source, cacheOptions);
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
