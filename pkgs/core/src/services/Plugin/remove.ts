import { rm } from "node:fs/promises";
import { join } from "node:path";
import { boxfileConfigStore } from "@boxfiles/config";
import { getPluginCacheEntry, type PluginCacheEntry, type PluginCacheRootOptions } from "./cache";
import { assertPluginDeclarationId, omitPluginDeclaration } from "./configDeclarations";
import { parsePluginSource } from "./source";

export type PluginRemoveDependencies = {
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

export async function removePluginDeclaration(
  id: string,
  options: PluginRemoveOptions,
): Promise<PluginRemoveResult> {
  assertPluginDeclarationId(id, (message) => new PluginRemoveError(message));
  const configPath = join(options.rootDir, ".boxfilesrc");
  const config = await boxfileConfigStore.read();
  const plugin = config.plugins.find((item) => item.name === id);
  if (plugin === undefined) throw new PluginRemoveError(`Plugin ${JSON.stringify(id)} is not declared in .boxfilesrc.`);

  const remainingPlugins = omitPluginDeclaration(Object.fromEntries(config.plugins.map((item) => [item.name, item.source])), id);
  const cacheEntry = getPluginCacheEntry(parsePluginSource(plugin.source), options.cache);
  const purgeSkippedReason = getPurgeSkippedReason(options.purge === true, cacheEntry, remainingPlugins, options.cache);
  await boxfileConfigStore.update((current) => ({
    ...current,
    plugins: current.plugins.filter((item) => item.name !== id),
  }));

  if (options.purge !== true) {
    return buildResult(id, plugin.source, configPath, false, "not-requested", cacheEntry);
  }

  if (cacheEntry === null) return buildResult(id, plugin.source, configPath, false, "not-cacheable", cacheEntry);
  if (purgeSkippedReason === "still-referenced") {
    return buildResult(id, plugin.source, configPath, false, "still-referenced", cacheEntry);
  }

  await (options.rm ?? defaultRm)(cacheEntry.path, { recursive: true, force: true });
  return buildResult(id, plugin.source, configPath, true, undefined, cacheEntry);
}

function buildResult(
  id: string,
  source: string,
  configPath: string,
  purged: boolean,
  purgeSkippedReason: PluginRemoveResult["purgeSkippedReason"],
  cacheEntry: PluginCacheEntry | null,
): PluginRemoveResult {
  return { id, source, configPath, purged, ...(purgeSkippedReason === undefined ? {} : { purgeSkippedReason }), ...(cacheEntry === null ? {} : { cacheEntry }) };
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
