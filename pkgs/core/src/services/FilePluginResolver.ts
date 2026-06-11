import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { FilePluginSource } from "./PluginSources";

export type FilePluginResolverFileSystem = {
  readonly stat: (path: string) => Promise<{ readonly isDirectory: () => boolean }>;
  readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
  readonly access: (path: string, mode?: number) => Promise<void>;
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

const fallbackEntryFiles = ["src/index.ts", "index.ts", "src/index.js", "index.js"] as const;

export async function resolveFilePluginSource(
  source: FilePluginSource,
  options: ResolveFilePluginSourceOptions,
): Promise<ResolvedFilePluginArtifact> {
  const fs = options.fs ?? nodeFileSystem;
  const pluginPath = resolveFileSourcePath(source.path, options.configPath);

  await assertPluginDirectoryExists(fs, pluginPath, source.path);
  const entryPath = await resolvePluginEntryPath(fs, pluginPath);

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

export async function resolvePluginEntryPath(
  fs: FilePluginResolverFileSystem,
  pluginPath: string,
): Promise<string> {
  const packageJsonPath = join(pluginPath, "package.json");
  if (await pathExists(fs, packageJsonPath)) {
    return resolvePackageJsonEntryPath(fs, pluginPath, packageJsonPath);
  }

  for (const entryFile of fallbackEntryFiles) {
    const entryPath = join(pluginPath, entryFile);
    if (await pathExists(fs, entryPath)) return entryPath;
  }

  throw new FilePluginResolveError(
    `Local plugin source ${JSON.stringify(pluginPath)} is missing package.json or one of ${fallbackEntryFiles.map((entry) => JSON.stringify(entry)).join(", ")}.`,
  );
}

async function resolvePackageJsonEntryPath(
  fs: FilePluginResolverFileSystem,
  pluginPath: string,
  packageJsonPath: string,
): Promise<string> {
  const packageJson = parsePackageJson(await fs.readFile(packageJsonPath, "utf8"), packageJsonPath);
  const entry = packageEntry(packageJson);

  if (entry === null) {
    throw new FilePluginResolveError(
      `Local plugin package ${JSON.stringify(packageJsonPath)} must declare a string exports, exports["."], or main entry.`,
    );
  }

  const entryPath = resolve(pluginPath, entry);
  if (!isPathInsideDirectory(entryPath, pluginPath)) {
    throw new FilePluginResolveError(
      `Local plugin package ${JSON.stringify(packageJsonPath)} entry ${JSON.stringify(entry)} must stay inside the plugin directory.`,
    );
  }

  if (!(await pathExists(fs, entryPath))) {
    throw new FilePluginResolveError(
      `Local plugin package ${JSON.stringify(packageJsonPath)} entry ${JSON.stringify(entry)} does not exist.`,
    );
  }

  return entryPath;
}

function isPathInsideDirectory(path: string, directory: string): boolean {
  const relativePath = relative(directory, path);
  return relativePath.length > 0
    && !relativePath.startsWith("..")
    && !isAbsolute(relativePath);
}

function parsePackageJson(text: string, packageJsonPath: string): Readonly<Record<string, unknown>> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new FilePluginResolveError(
      `Local plugin package ${JSON.stringify(packageJsonPath)} contains invalid JSON.`,
    );
  }

  if (!isPlainObject(parsed)) {
    throw new FilePluginResolveError(
      `Local plugin package ${JSON.stringify(packageJsonPath)} must contain a JSON object.`,
    );
  }

  return parsed;
}

function packageEntry(packageJson: Readonly<Record<string, unknown>>): string | null {
  const exportsValue = packageJson["exports"];
  if (typeof exportsValue === "string") return exportsValue;

  if (isPlainObject(exportsValue)) {
    const rootExport = exportsValue["."];
    if (typeof rootExport === "string") return rootExport;
  }

  const mainValue = packageJson["main"];
  return typeof mainValue === "string" ? mainValue : null;
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

async function pathExists(fs: FilePluginResolverFileSystem, path: string): Promise<boolean> {
  try {
    await fs.access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT") || hasErrorCode(error, "ENOTDIR")) return false;
    throw new FilePluginResolveError(
      `Unable to access local plugin path ${JSON.stringify(path)}: ${formatUnknownError(error)}`,
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
