// npm.ts
//
// Fetches npm plugin sources into Boxfiles' plugin cache without touching the
// target project. `npm pack` runs in a private temp directory, scripts are
// disabled, and only the packed tarball content is committed to cache.
//
// This isolation is deliberate: plugin installation must not create
// `node_modules`, lockfiles, or package metadata beside the user's manifests.
import { cp, mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { PluginCacheEntry, PluginCacheRootOptions } from "../cache";
import { getPluginCacheEntry } from "../cache";
import {
  commitPluginCacheArtifact,
  createPluginCacheTransactionDirectory,
  type PluginCacheTransactionFileSystem,
} from "../cacheTransaction";
import type { NpmPluginSource } from "../source";

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

export type NpmPluginInstallerFileSystem = PluginCacheTransactionFileSystem & {
  readonly readdir: (path: string) => Promise<readonly string[]>;
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

  const tempDirectory = await createPluginCacheTransactionDirectory(fs, cacheEntry, options);

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
    await commitPluginCacheArtifact(fs, unpackDirectory, cacheEntry.path);
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
