import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BoxfileConfigSchema, boxfileConfigStore } from "@boxfiles/config";
import { BoxfilesRcParseError, BoxfilesRcReadError, BoxfilesRcValidationError } from "../../exceptions/config";
import { resolveFilePluginSource } from "./transports/file";
import { installGitPluginSource } from "./transports/git";
import { installNpmPluginSource } from "./transports/npm";
import { getPluginCacheEntry, type PluginCacheRootOptions } from "./cache";
import { assertPluginDeclarationId } from "./configDeclarations";
import { parsePluginSource, type FilePluginSource, type GitPluginSource, type NpmPluginSource, type ParsedPluginSource } from "./source";
import { pluginReproducibilityWarning, type PluginReproducibilityWarning } from "./warnings";

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
  assertPluginDeclarationId(id, (message) => new PluginInstallError(message));
  const source = parsePluginSource(sourceText);
  const configPath = join(options.rootDir, ".boxfilesrc");
  const fs = options.fs ?? nodeFileSystem;
  await readExistingConfig(configPath, fs);

  await validateAndPopulateCache(source, configPath, options);
  await writePluginDeclarationWithDiagnostics(configPath, id, sourceText, source, options.cache);

  return { id, source: sourceText, kind: source.kind, configPath, warning: pluginReproducibilityWarning(id, sourceText) };
}

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

async function writePluginDeclarationWithDiagnostics(
  configPath: string,
  id: string,
  sourceText: string,
  source: ParsedPluginSource,
  cacheOptions: PluginCacheRootOptions | undefined,
): Promise<void> {
  try {
    await boxfileConfigStore.update((current) => ({
      ...current,
      plugins: [...current.plugins.filter((plugin) => plugin.name !== id), { name: id, source: sourceText }],
    }));
  } catch (error) {
    const cacheEntry = getPluginCacheEntry(source, cacheOptions);
    if (cacheEntry === null) throw error;
    throw new PluginInstallError(
      `Failed to update .boxfilesrc after populating plugin cache at ${cacheEntry.path}. Repair by removing that cache directory or rerunning boxfiles plugin install. Cause: ${formatUnknownError(error)}`,
    );
  }
}

async function readExistingConfig(
  configPath: string,
  fs: PluginInstallFileSystem,
): Promise<void> {
  try {
    const text = await fs.readFile(configPath, "utf8");
    const raw = JSON.parse(text) as unknown;
    BoxfileConfigSchema.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new PluginInstallError(`Unable to parse .boxfilesrc as JSON: ${error.message}`);
    }

    if (error instanceof Error && (error as { readonly cause?: unknown }).cause instanceof Error) {
      throw new PluginInstallError(`Unable to read .boxfilesrc: ${(error as { readonly cause: Error }).cause.message}`);
    }

    if (error instanceof Error) {
      throw error;
    }
  }
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
