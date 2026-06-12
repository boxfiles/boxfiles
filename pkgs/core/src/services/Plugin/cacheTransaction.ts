import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { resolvePluginCacheRoot, type PluginCacheEntry, type PluginCacheRootOptions } from "./cache";

export type PluginCacheTransactionFileSystem = {
  readonly mkdir: (path: string, options?: { readonly recursive?: boolean }) => Promise<void>;
  readonly mkdtemp: (prefix: string) => Promise<string>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly rm: (path: string, options?: { readonly recursive?: boolean; readonly force?: boolean }) => Promise<void>;
  readonly cp: (from: string, to: string, options?: { readonly recursive?: boolean }) => Promise<void>;
};

export type PluginCacheTransactionOptions = PluginCacheRootOptions & {
  readonly tempRoot?: string;
};

export async function createPluginCacheTransactionDirectory(
  fs: PluginCacheTransactionFileSystem,
  cacheEntry: PluginCacheEntry,
  options: PluginCacheTransactionOptions,
): Promise<string> {
  const cacheRoot = resolvePluginCacheRoot(options);
  const tempRoot = options.tempRoot ?? join(cacheRoot, ".tmp");
  await fs.mkdir(tempRoot, { recursive: true });
  return await fs.mkdtemp(join(tempRoot, `${cacheEntry.directoryName}-`));
}

/**
 * Replaces a cache artifact as a small transaction. Existing cache state is
 * moved aside, new state is placed, and old state is restored if placement
 * fails. Cross-device moves fall back to copy+remove only for EXDEV.
 */
export async function commitPluginCacheArtifact(
  fs: PluginCacheTransactionFileSystem,
  from: string,
  to: string,
): Promise<void> {
  const backup = `${to}.previous-${randomUUID()}`;
  const hadExistingEntry = await moveExistingEntryAside(fs, to, backup);

  try {
    await moveDirectoryAcrossDevices(fs, from, to);
  } catch (error) {
    await fs.rm(to, { recursive: true, force: true });
    if (hadExistingEntry) await moveDirectoryAcrossDevices(fs, backup, to);
    throw error;
  }

  if (hadExistingEntry) await fs.rm(backup, { recursive: true, force: true });
}

async function moveExistingEntryAside(
  fs: PluginCacheTransactionFileSystem,
  from: string,
  backup: string,
): Promise<boolean> {
  try {
    await fs.rename(from, backup);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return false;
    throw error;
  }
}

async function moveDirectoryAcrossDevices(
  fs: PluginCacheTransactionFileSystem,
  from: string,
  to: string,
): Promise<void> {
  try {
    await fs.rename(from, to);
  } catch (error) {
    if (!hasErrorCode(error, "EXDEV")) throw error;
    await fs.cp(from, to, { recursive: true });
    await fs.rm(from, { recursive: true, force: true });
  }
}

function hasErrorCode(value: unknown, code: string): boolean {
  return typeof value === "object"
    && value !== null
    && "code" in value
    && value.code === code;
}
