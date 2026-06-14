import { access, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { boxfileConfigStore } from "@boxfiles/config";
import { resolvePluginArtifactEntryPath } from "./artifact";
import { getPluginCacheEntry, type PluginCacheRootOptions } from "./cache";
import { resolveFilePluginSource, type FilePluginResolverFileSystem } from "./transports/file";
import { parsePluginSource, type ParsedPluginSource } from "./source";
import { normalizePluginModule, type PluginService, type PluginSource } from "./index";

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

const nodeFileSystem: PluginLoaderFileSystem = { stat, readFile, access };

export async function loadInstalledPlugins(
  options: LoadInstalledPluginsOptions,
): Promise<readonly LoadedPluginModuleDto[]> {
  const fs = options.fs ?? nodeFileSystem;
  const loaded: LoadedPluginModuleDto[] = [];
  const config = await boxfileConfigStore.read();

  for (const declaration of config.plugins) {
    const source = parsePluginSource(declaration.source);
    const entryPath = await resolvePluginDeclarationEntryPath(source, fs, options.cache);
    const moduleValue = await importPluginModule(entryPath, options.importModule);
    options.pluginService.registerPlugin(normalizePluginModule(moduleValue), pluginSourceFor(source));
    loaded.push({ name: declaration.name, source: declaration.source, kind: source.kind, entryPath });
  }

  return loaded;
}

async function resolvePluginDeclarationEntryPath(
  source: ParsedPluginSource,
  fs: PluginLoaderFileSystem,
  cacheOptions: PluginCacheRootOptions | undefined,
): Promise<string> {
  if (source.kind === "file") {
    const artifact = await resolveFilePluginSource(source, { configPath: join("", ".boxfilesrc"), fs });
    return artifact.entryPath;
  }

  const cacheEntry = getPluginCacheEntry(source, cacheOptions);
  if (cacheEntry === null) {
    throw new PluginLoadError(`Plugin source ${source.kind} did not produce a cache entry.`);
  }

  await assertCachedPluginDirectory(cacheEntry.path, fs);
  return await resolvePluginArtifactEntryPath(cacheEntry.path, fs);
}

async function assertCachedPluginDirectory(cachePath: string, fs: PluginLoaderFileSystem): Promise<void> {
  const cacheStat = await fs.stat(cachePath);
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
