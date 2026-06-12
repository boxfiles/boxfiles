import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

export type PluginArtifactFileSystem = {
  readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
  readonly access: (path: string, mode?: number) => Promise<void>;
};

export class PluginArtifactEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginArtifactEntryError";
  }
}

const nodeFileSystem: PluginArtifactFileSystem = {
  readFile,
  access,
};

const fallbackEntryFiles = ["src/index.ts", "index.ts", "src/index.js", "index.js"] as const;

/**
 * Finds an installed plugin artifact entrypoint using package metadata first,
 * then legacy root fallbacks. Package entries must stay inside the artifact
 * directory so cached npm/git plugins cannot escape into arbitrary files.
 */
export async function resolvePluginArtifactEntryPath(
  pluginPath: string,
  fs: PluginArtifactFileSystem = nodeFileSystem,
): Promise<string> {
  const packageJsonPath = join(pluginPath, "package.json");
  if (await pathExists(fs, packageJsonPath)) {
    return resolvePackageJsonEntryPath(fs, pluginPath, packageJsonPath);
  }

  for (const entryFile of fallbackEntryFiles) {
    const entryPath = join(pluginPath, entryFile);
    if (await pathExists(fs, entryPath)) return entryPath;
  }

  throw new PluginArtifactEntryError(
    `Plugin artifact ${JSON.stringify(pluginPath)} is missing package.json or one of ${fallbackEntryFiles.map((entry) => JSON.stringify(entry)).join(", ")}.`,
  );
}

async function resolvePackageJsonEntryPath(
  fs: PluginArtifactFileSystem,
  pluginPath: string,
  packageJsonPath: string,
): Promise<string> {
  const packageJson = parsePackageJson(await fs.readFile(packageJsonPath, "utf8"), packageJsonPath);
  const entry = packageEntry(packageJson);

  if (entry === null) {
    throw new PluginArtifactEntryError(
      `Plugin package ${JSON.stringify(packageJsonPath)} must declare a string exports, exports["."], or main entry.`,
    );
  }

  const entryPath = resolve(pluginPath, entry);
  if (!isPathInsideDirectory(entryPath, pluginPath)) {
    throw new PluginArtifactEntryError(
      `Plugin package ${JSON.stringify(packageJsonPath)} entry ${JSON.stringify(entry)} must stay inside the plugin directory.`,
    );
  }

  if (!(await pathExists(fs, entryPath))) {
    throw new PluginArtifactEntryError(
      `Plugin package ${JSON.stringify(packageJsonPath)} entry ${JSON.stringify(entry)} does not exist.`,
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
    throw new PluginArtifactEntryError(
      `Plugin package ${JSON.stringify(packageJsonPath)} contains invalid JSON.`,
    );
  }

  if (!isPlainObject(parsed)) {
    throw new PluginArtifactEntryError(
      `Plugin package ${JSON.stringify(packageJsonPath)} must contain a JSON object.`,
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

async function pathExists(fs: PluginArtifactFileSystem, path: string): Promise<boolean> {
  try {
    await fs.access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT") || hasErrorCode(error, "ENOTDIR")) return false;
    throw new PluginArtifactEntryError(
      `Unable to access plugin artifact path ${JSON.stringify(path)}: ${formatUnknownError(error)}`,
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
