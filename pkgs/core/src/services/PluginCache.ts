// PluginCache.ts
//
// Defines deterministic cache locations for remote plugin artifacts. npm and
// git sources are cacheable because install fetches bytes into Boxfiles-owned
// storage. file sources return no cache entry because they remain live local
// paths by design.
//
// Cache names combine a readable label with a hash of the canonical source spec
// so version/ref differences do not collide while paths stay filesystem-safe.
import { createHash } from "node:crypto";
import { homedir as defaultHomedir } from "node:os";
import { basename, join } from "node:path";
import type { GitPluginSource, NpmPluginSource, ParsedPluginSource } from "./PluginSources";

export type CacheablePluginSource = NpmPluginSource | GitPluginSource;
export type PluginCacheTransport = CacheablePluginSource["kind"];

export type PluginCacheRootOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly homedir?: string;
};

export type PluginCacheEntry = {
  readonly transport: PluginCacheTransport;
  readonly directoryName: string;
  readonly path: string;
};

const pluginCachePathSegments = ["boxfiles", "plugins"] as const;

export function resolvePluginCacheRoot(options: PluginCacheRootOptions = {}): string {
  const env = options.env ?? process.env;
  const xdgCacheHome = env["XDG_CACHE_HOME"]?.trim();
  const baseCacheDirectory = xdgCacheHome && xdgCacheHome.length > 0
    ? xdgCacheHome
    : join(options.homedir ?? defaultHomedir(), ".cache");

  return join(baseCacheDirectory, ...pluginCachePathSegments);
}

/**
 * Returns the cache entry a future loader should read for an installed remote
 * plugin. `null` for file sources is part of the contract: callers must not
 * create a cached copy of local machine state.
 */
 export function getPluginCacheEntry(
  source: ParsedPluginSource,
  options: PluginCacheRootOptions = {},
): PluginCacheEntry | null {
  if (source.kind === "file") return null;

  const transport = source.kind;
  const canonicalSpec = canonicalPluginSourceSpec(source);
  const safeName = safeCacheEntryName(cacheEntryDisplayName(source));
  const hash = hashPluginSourceSpec(canonicalSpec);
  const directoryName = `${safeName}__${hash}`;

  return {
    transport,
    directoryName,
    path: join(resolvePluginCacheRoot(options), transport, directoryName),
  };
}

// Canonical specs are the cache identity. If lockfiles later pin resolved
// versions/commits, this function is the fence where identity semantics change.
function canonicalPluginSourceSpec(source: CacheablePluginSource): string {
  switch (source.kind) {
    case "npm":
      return source.version === undefined
        ? `npm:${source.packageName}`
        : `npm:${source.packageName}@${source.version}`;
    case "git":
      return source.ref === undefined
        ? `git:${source.url}`
        : `git:${source.url}#${source.ref}`;
  }
}

function cacheEntryDisplayName(source: CacheablePluginSource): string {
  if (source.kind === "npm") return source.packageName;

  const withoutFragment = source.url.split("#", 1)[0] ?? source.url;
  const pathLike = withoutFragment.endsWith("/") ? withoutFragment.slice(0, -1) : withoutFragment;
  const candidate = basename(pathLike).replace(/\.git$/u, "");
  return candidate.length > 0 ? candidate : "repository";
}

function safeCacheEntryName(name: string): string {
  const slashFreeName = name.replace(/[\\/]+/gu, "__");
  const safeName = slashFreeName
    .replace(/[^A-Za-z0-9._@~-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^\.+|\.+$/gu, "");

  return safeName.length > 0 ? safeName : "plugin";
}

function hashPluginSourceSpec(canonicalSpec: string): string {
  // Source specs may contain URLs, refs, scoped npm names, and version ranges with
  // filesystem-significant characters. Hashing the full canonical spec keeps cache
  // entries unique without trusting those unsafe strings as path segments.
  return createHash("sha256").update(canonicalSpec).digest("hex").slice(0, 16);
}
