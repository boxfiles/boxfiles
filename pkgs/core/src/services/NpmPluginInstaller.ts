// NpmPluginInstaller.ts
//
// Fetches npm plugin sources into Boxfiles' plugin cache without touching the
// target project. `npm pack` runs in a private temp directory, scripts are
// disabled, and only the packed tarball content is committed to cache.
//
// This isolation is deliberate: plugin installation must not create
// `node_modules`, lockfiles, or package metadata beside the user's manifests.
import { mkdir, readdir, rename, rm, cp, mkdtemp } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { PluginCacheEntry, PluginCacheRootOptions } from "./PluginCache";
import { getPluginCacheEntry, resolvePluginCacheRoot } from "./PluginCache";
import type { NpmPluginSource } from "./PluginSources";

export type CommandRunOptions = {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
};

export type CommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: CommandRunOptions,
) => Promise<CommandResult>;

export type NpmPluginInstallerFileSystem = {
  readonly mkdir: (path: string, options?: { readonly recursive?: boolean }) => Promise<void>;
  readonly mkdtemp: (prefix: string) => Promise<string>;
  readonly readdir: (path: string) => Promise<readonly string[]>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly rm: (path: string, options?: { readonly recursive?: boolean; readonly force?: boolean }) => Promise<void>;
  readonly cp: (from: string, to: string, options?: { readonly recursive?: boolean }) => Promise<void>;
};

export type InstallNpmPluginSourceOptions = PluginCacheRootOptions & {
  readonly commandRunner?: CommandRunner;
  readonly fs?: NpmPluginInstallerFileSystem;
  readonly tempRoot?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
};

export class NpmPluginFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NpmPluginFetchError";
  }
}

export async function installNpmPluginSource(
  source: NpmPluginSource,
  options: InstallNpmPluginSourceOptions = {},
): Promise<PluginCacheEntry> {
  const fs = options.fs ?? nodeFileSystem;
  const runner = options.commandRunner ?? defaultCommandRunner;
  const cacheEntry = getPluginCacheEntry(source, options);
  if (cacheEntry === null) throw new NpmPluginFetchError("npm plugin source did not produce a cache entry");

  const cacheRoot = resolvePluginCacheRoot(options);

  // Use a temp directory under the cache root so failed `npm pack` or tar
  // extraction cannot leave a half-written cache entry that the loader might
  // later mistake for an installed plugin.
  const tempRoot = options.tempRoot ?? join(cacheRoot, ".tmp");
  await fs.mkdir(tempRoot, { recursive: true });
  const tempDirectory = await fs.mkdtemp(join(tempRoot, `${cacheEntry.directoryName}-`));

  try {
    const packDirectory = join(tempDirectory, "pack");
    const unpackDirectory = join(tempDirectory, "package");
    await fs.mkdir(packDirectory, { recursive: true });
    await fs.mkdir(unpackDirectory, { recursive: true });

    const specifier = npmSpecifier(source);
    // `npm pack --ignore-scripts` gives us the published package payload while
    // avoiding dependency install and lifecycle script execution in the project.
    const packResult = await runner("npm", [
      "pack",
      specifier,
      "--pack-destination",
      packDirectory,
      "--ignore-scripts",
      "--json",
    ], { cwd: tempDirectory, env: options.env });
    assertSuccessfulCommand("npm pack", packResult);

    const tarballPath = await resolvePackedTarballPath(fs, packDirectory, packResult.stdout);
    const extractResult = await runner("tar", [
      "-xzf",
      tarballPath,
      "-C",
      unpackDirectory,
      "--strip-components",
      "1",
    ], { cwd: tempDirectory, env: options.env });
    assertSuccessfulCommand("tar extract", extractResult);

    await fs.mkdir(dirname(cacheEntry.path), { recursive: true });
    // Commit only after extraction succeeds. Until this point `cacheEntry.path`
    // must remain absent or contain the previous good artifact.
    await commitDirectory(fs, unpackDirectory, cacheEntry.path);
    return cacheEntry;
  } catch (error) {
    if (error instanceof NpmPluginFetchError) throw error;
    throw new NpmPluginFetchError(`Failed to fetch npm plugin ${npmSpecifier(source)}: ${formatUnknownError(error)}`);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

function npmSpecifier(source: NpmPluginSource): string {
  return source.version === undefined ? source.packageName : `${source.packageName}@${source.version}`;
}

function assertSuccessfulCommand(label: string, result: CommandResult): void {
  if (result.exitCode === 0) return;

  const output = [result.stderr.trim(), result.stdout.trim()].filter((part) => part.length > 0).join("\n");
  const suffix = output.length > 0 ? ` Output:\n${output}` : "";
  throw new NpmPluginFetchError(`${label} failed with exit code ${result.exitCode}.${suffix}`);
}

async function resolvePackedTarballPath(
  fs: NpmPluginInstallerFileSystem,
  packDirectory: string,
  stdout: string,
): Promise<string> {
  const parsedFilename = parseNpmPackFilename(stdout);
  if (parsedFilename !== null) {
    if (!isSafePackedTarballName(parsedFilename)) {
      throw new NpmPluginFetchError(`npm pack reported an unsafe tarball filename: ${parsedFilename}`);
    }
    return join(packDirectory, parsedFilename);
  }
  const tarballs = (await fs.readdir(packDirectory)).filter(isSafePackedTarballName);
  if (tarballs.length === 1 && tarballs[0] !== undefined) return join(packDirectory, tarballs[0]);

  throw new NpmPluginFetchError("npm pack succeeded but no single tarball artifact could be identified");
}

function parseNpmPackFilename(stdout: string): string | null {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return null;
    const first = parsed[0] as unknown;
    if (!isPackJsonEntry(first)) return null;
    return first.filename;
  } catch {
    const firstLine = trimmed.split("\n")[0];
    return firstLine?.endsWith(".tgz") === true ? firstLine : null;
  }
}

function isPackJsonEntry(value: unknown): value is { readonly filename: string } {
  if (typeof value !== "object" || value === null) return false;
  if (!("filename" in value)) return false;
  return typeof value.filename === "string" && value.filename.length > 0;
}

function isSafePackedTarballName(filename: string): boolean {
  return filename.endsWith(".tgz")
    && basename(filename) === filename
    && !filename.includes("\\");
}

async function commitDirectory(fs: NpmPluginInstallerFileSystem, from: string, to: string): Promise<void> {
// `rename` is atomic on one filesystem. EXDEV happens when tests or custom
// cache roots cross mount boundaries, so fall back to copy+remove only then.
  await fs.rm(to, { recursive: true, force: true });
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

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const nodeFileSystem: NpmPluginInstallerFileSystem = {
  mkdir: async (path, options) => { void await mkdir(path, options); },
  mkdtemp,
  readdir,
  rename,
  rm,
  cp,
};

const defaultCommandRunner: CommandRunner = async (command, args, options) => {
  const spawned = Bun.spawn([command, ...args], {
    cwd: options.cwd,
    env: options.env === undefined ? undefined : { ...process.env, ...options.env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(spawned.stdout).text(),
    new Response(spawned.stderr).text(),
    spawned.exited,
  ]);

  return { exitCode, stdout, stderr };
};
