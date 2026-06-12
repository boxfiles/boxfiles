// remove.ts
//
// Removes plugin declarations from `.boxfilesrc` and optionally purges cached
// remote artifacts. Purge is conservative: if another declaration resolves to
// the same cache entry, the cache directory stays on disk.

import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BoxfilesRcParseError, BoxfilesRcReadError, BoxfilesRcValidationError } from "../../exceptions/config";
import { BoxfilesRcConfigDTO, readBoxfilesRcConfig, type BoxfilesRcConfigDto } from "../Config";
import { getPluginCacheEntry, type PluginCacheEntry, type PluginCacheRootOptions } from "./cache";
import { parsePluginSource } from "./source";

export type PluginRemoveFileSystem = {
  readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
  readonly writeFile: (path: string, data: string) => Promise<void>;
};

export type PluginRemoveDependencies = {
  readonly fs?: PluginRemoveFileSystem;
  readonly rm?: (path: string, options: { readonly recursive: true; readonly force: true }) => Promise<void>;
  readonly cache?: PluginCacheRootOptions;
};

export type PluginRemoveOptions = PluginRemoveDependencies & {
  readonly rootDir: string;
  readonly purge?: boolean;
};

export type PluginRemoveResult = {
  readonly id: string;
  readonly source: string;
  readonly configPath: string;
  readonly purged: boolean;
  readonly purgeSkippedReason?: "not-requested" | "not-cacheable" | "still-referenced";
  readonly cacheEntry?: PluginCacheEntry;
};

export class PluginRemoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginRemoveError";
  }
}

const nodeFileSystem: PluginRemoveFileSystem = { readFile, writeFile };

export async function removePluginDeclaration(
  id: string,
  options: PluginRemoveOptions,
): Promise<PluginRemoveResult> {
  validatePluginId(id);
  const configPath = join(options.rootDir, ".boxfilesrc");
  const fs = options.fs ?? nodeFileSystem;
  const config = await readExistingConfig(configPath, fs);
  const plugins = readPluginMap(config);
  const sourceText = plugins[id];
  if (sourceText === undefined) throw new PluginRemoveError(`Plugin ${JSON.stringify(id)} is not declared in .boxfilesrc.`);

  const remainingPlugins = omitPlugin(plugins, id);
  const cacheEntry = getPluginCacheEntry(parsePluginSource(sourceText), options.cache);
  const purgeSkippedReason = getPurgeSkippedReason(options.purge === true, cacheEntry, remainingPlugins, options.cache);
  const updated = buildUpdatedConfig(config, remainingPlugins);
  BoxfilesRcConfigDTO.parse(updated);
  await fs.writeFile(configPath, `${JSON.stringify(updated, null, 2)}\n`);

  if (options.purge !== true) {
    return buildResult(id, sourceText, configPath, false, "not-requested", cacheEntry);
  }

  if (cacheEntry === null) return buildResult(id, sourceText, configPath, false, "not-cacheable", cacheEntry);
  if (purgeSkippedReason === "still-referenced") {
    return buildResult(id, sourceText, configPath, false, "still-referenced", cacheEntry);
  }

  await (options.rm ?? defaultRm)(cacheEntry.path, { recursive: true, force: true });
  return buildResult(id, sourceText, configPath, true, undefined, cacheEntry);
}

function buildResult(
  id: string,
  source: string,
  configPath: string,
  purged: boolean,
  purgeSkippedReason: PluginRemoveResult["purgeSkippedReason"],
  cacheEntry: PluginCacheEntry | null,
): PluginRemoveResult {
  return {
    id,
    source,
    configPath,
    purged,
    ...(purgeSkippedReason === undefined ? {} : { purgeSkippedReason }),
    ...(cacheEntry === null ? {} : { cacheEntry }),
  };
}

function getPurgeSkippedReason(
  shouldPurge: boolean,
  cacheEntry: PluginCacheEntry | null,
  remainingPlugins: Readonly<Record<string, string>>,
  cacheOptions: PluginCacheRootOptions | undefined,
): PluginRemoveResult["purgeSkippedReason"] {
  if (!shouldPurge) return "not-requested";
  if (cacheEntry === null) return "not-cacheable";
  if (isCacheEntryReferenced(cacheEntry, remainingPlugins, cacheOptions)) return "still-referenced";
  return undefined;
}

async function defaultRm(path: string, options: { readonly recursive: true; readonly force: true }): Promise<void> {
  await rm(path, options);
}

function isCacheEntryReferenced(
  target: PluginCacheEntry,
  plugins: Readonly<Record<string, string>>,
  cacheOptions: PluginCacheRootOptions | undefined,
): boolean {
  return Object.values(plugins).some((sourceText) => {
    const entry = getPluginCacheEntry(parsePluginSource(sourceText), cacheOptions);
    return entry !== null && entry.path === target.path;
  });
}

function buildUpdatedConfig(
  config: Readonly<Record<string, unknown>>,
  plugins: Readonly<Record<string, string>>,
): Readonly<Record<string, unknown>> {
  if (Object.keys(plugins).length > 0) return { ...config, plugins };
  const { plugins: _removed, ...rest } = config;
  void _removed;
  return rest;
}

function omitPlugin(
  plugins: Readonly<Record<string, string>>,
  id: string,
): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(plugins).filter(([pluginId]) => pluginId !== id));
}

async function readExistingConfig(
  configPath: string,
  fs: PluginRemoveFileSystem,
): Promise<Readonly<Record<string, unknown>>> {
  try {
    return configDtoToWritableConfig(await readBoxfilesRcConfig(configPath, { fs, missingFile: "throw" }));
  } catch (error) {
    if (error instanceof BoxfilesRcReadError && hasErrorCode(error.cause, "ENOENT")) {
      throw new PluginRemoveError(".boxfilesrc does not exist.");
    }

    if (error instanceof BoxfilesRcReadError) {
      throw error.cause;
    }

    if (error instanceof BoxfilesRcParseError) {
      throw new PluginRemoveError(`Unable to parse .boxfilesrc as JSON: ${formatUnknownError(error.cause)}`);
    }

    if (error instanceof BoxfilesRcValidationError && !isPlainObject(error.value)) {
      throw new PluginRemoveError(".boxfilesrc must contain a JSON object.");
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
  return Object.fromEntries(Object.entries(plugins).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function validatePluginId(id: string): void {
  if (id.trim().length > 0) return;
  throw new PluginRemoveError("Plugin id must be non-empty.");
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasErrorCode(value: unknown, code: string): boolean {
  return typeof value === "object" && value !== null && "code" in value && value.code === code;
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
