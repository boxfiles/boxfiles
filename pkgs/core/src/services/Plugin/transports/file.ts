import { access, readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { resolvePluginArtifactEntryPath, type PluginArtifactFileSystem } from "../artifact";
import type { FilePluginSource } from "../source";

export type FilePluginResolverFileSystem = PluginArtifactFileSystem & {
  readonly stat: (path: string) => Promise<{ readonly isDirectory: () => boolean }>;
};

export type ResolveFilePluginSourceOptions = {
  readonly configPath: string;
  readonly fs?: FilePluginResolverFileSystem;
};

export type ResolvedFilePluginArtifact = {
  readonly kind: "file";
  readonly path: string;
  readonly entryPath: string;
  readonly source: FilePluginSource;
  readonly local: true;
  readonly nonReproducible: true;
};

export class FilePluginResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilePluginResolveError";
  }
}

const nodeFileSystem: FilePluginResolverFileSystem = {
  stat,
  readFile,
  access,
};

/**
 * Resolves a live file: plugin source. This validates the local path and entry
 * without copying anything into cache, because file plugins intentionally remain
 * local workstation state.
 */
export async function resolveFilePluginSource(
  source: FilePluginSource,
  options: ResolveFilePluginSourceOptions,
): Promise<ResolvedFilePluginArtifact> {
  const fs = options.fs ?? nodeFileSystem;
  const pluginPath = resolveFileSourcePath(source.path, options.configPath);

  await assertPluginDirectoryExists(fs, pluginPath, source.path);
  const entryPath = await resolvePluginArtifactEntryPath(pluginPath, fs);

  return {
    kind: "file",
    path: pluginPath,
    entryPath,
    source,
    local: true,
    nonReproducible: true,
  };
}

export function resolveFileSourcePath(sourcePath: string, configPath: string): string {
  return isAbsolute(sourcePath)
    ? resolve(sourcePath)
    : resolve(dirname(configPath), sourcePath);
}

async function assertPluginDirectoryExists(
  fs: FilePluginResolverFileSystem,
  pluginPath: string,
  originalPath: string,
): Promise<void> {
  let pluginStat: { readonly isDirectory: () => boolean };

  try {
    pluginStat = await fs.stat(pluginPath);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT") || hasErrorCode(error, "ENOTDIR")) {
      throw new FilePluginResolveError(
        `Local plugin source ${JSON.stringify(originalPath)} resolved to ${JSON.stringify(pluginPath)} but does not exist.`,
      );
    }

    throw new FilePluginResolveError(
      `Unable to inspect local plugin source ${JSON.stringify(originalPath)} resolved to ${JSON.stringify(pluginPath)}: ${formatUnknownError(error)}`,
    );
  }

  if (!pluginStat.isDirectory()) {
    throw new FilePluginResolveError(
      `Local plugin source ${JSON.stringify(originalPath)} resolved to ${JSON.stringify(pluginPath)} but is not a directory.`,
    );
  }
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
