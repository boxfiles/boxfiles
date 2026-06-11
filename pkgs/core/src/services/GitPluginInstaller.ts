import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PluginCacheEntry, PluginCacheRootOptions } from "./PluginCache";
import { getPluginCacheEntry, resolvePluginCacheRoot } from "./PluginCache";
import type { GitPluginSource } from "./PluginSources";

export type GitCommandRunOptions = {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
};

export type GitCommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type GitCommandRunner = (
  command: string,
  args: readonly string[],
  options: GitCommandRunOptions,
) => Promise<GitCommandResult>;

export type GitPluginInstallerFileSystem = {
  readonly mkdir: (path: string, options?: { readonly recursive?: boolean }) => Promise<void>;
  readonly mkdtemp: (prefix: string) => Promise<string>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly rm: (path: string, options?: { readonly recursive?: boolean; readonly force?: boolean }) => Promise<void>;
  readonly cp: (from: string, to: string, options?: { readonly recursive?: boolean }) => Promise<void>;
  readonly writeFile: (path: string, data: string) => Promise<void>;
};

export type GitPluginInstallMetadata = {
  readonly requestedUrl: string;
  readonly requestedRef?: string;
  readonly resolvedCommit?: string;
};

export type GitPluginInstallResult = {
  readonly cacheEntry: PluginCacheEntry;
  readonly metadata: GitPluginInstallMetadata;
};

export type InstallGitPluginSourceOptions = PluginCacheRootOptions & {
  readonly commandRunner?: GitCommandRunner;
  readonly fs?: GitPluginInstallerFileSystem;
  readonly tempRoot?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
};

export class GitPluginFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitPluginFetchError";
  }
}

const metadataFilename = ".boxfiles-plugin-source.json";

export async function installGitPluginSource(
  source: GitPluginSource,
  options: InstallGitPluginSourceOptions = {},
): Promise<GitPluginInstallResult> {
  const fs = options.fs ?? nodeFileSystem;
  const runner = options.commandRunner ?? defaultGitCommandRunner;
  const cacheEntry = getPluginCacheEntry(source, options);
  if (cacheEntry === null) throw new GitPluginFetchError("git plugin source did not produce a cache entry");

  const cacheRoot = resolvePluginCacheRoot(options);
  const tempRoot = options.tempRoot ?? join(cacheRoot, ".tmp");
  await fs.mkdir(tempRoot, { recursive: true });
  const tempDirectory = await fs.mkdtemp(join(tempRoot, `${cacheEntry.directoryName}-`));

  try {
    const cloneDirectory = join(tempDirectory, "clone");
    const cloneResult = await runner("git", cloneArgs(source, cloneDirectory), { cwd: tempDirectory, env: options.env });
    assertSuccessfulGitCommand("git clone", cloneResult);

    if (source.ref !== undefined) {
      await checkoutGitRef(runner, source.ref, cloneDirectory, options.env);
    }

    const commitResult = await runner("git", ["rev-parse", "HEAD"], { cwd: cloneDirectory, env: options.env });
    assertSuccessfulGitCommand("git rev-parse HEAD", commitResult);

    const resolvedCommit = normalizeResolvedCommit(commitResult.stdout);
    const metadata = buildMetadata(source, resolvedCommit);
    await fs.writeFile(join(cloneDirectory, metadataFilename), `${JSON.stringify(metadata, null, 2)}\n`);
    await fs.mkdir(dirname(cacheEntry.path), { recursive: true });
    await commitDirectory(fs, cloneDirectory, cacheEntry.path);

    return { cacheEntry, metadata };
  } catch (error) {
    if (error instanceof GitPluginFetchError) throw error;
    throw new GitPluginFetchError(`Failed to fetch git plugin ${gitSpecifier(source)}: ${formatUnknownError(error)}`);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

function cloneArgs(source: GitPluginSource, cloneDirectory: string): readonly string[] {
  return source.ref === undefined
    ? ["clone", "--depth", "1", source.url, cloneDirectory]
    : ["clone", "--no-checkout", source.url, cloneDirectory];
}

async function checkoutGitRef(
  runner: GitCommandRunner,
  ref: string,
  cloneDirectory: string,
  env: Readonly<Record<string, string | undefined>> | undefined,
): Promise<void> {
  const attemptedRefs: string[] = [];
  const failures: GitCommandResult[] = [];

  for (const candidate of checkoutRefCandidates(ref)) {
    attemptedRefs.push(candidate);
    const result = await runner("git", ["checkout", "--detach", candidate], { cwd: cloneDirectory, env });
    if (result.exitCode === 0) return;
    failures.push(result);
  }

  const output = failures
    .flatMap((failure) => [failure.stderr.trim(), failure.stdout.trim()])
    .filter((part) => part.length > 0)
    .join("\n");
  const suffix = output.length > 0 ? ` Output:\n${output}` : "";
  throw new GitPluginFetchError(`git checkout failed for ref ${JSON.stringify(ref)} (tried ${attemptedRefs.join(", ")}).${suffix}`);
}

function checkoutRefCandidates(ref: string): readonly string[] {
  if (ref.startsWith("refs/heads/")) return [ref, `origin/${ref.slice("refs/heads/".length)}`];
  if (ref.startsWith("refs/tags/")) return [ref, ref.slice("refs/tags/".length)];
  if (ref.startsWith("origin/")) return [ref];
  return [ref, `origin/${ref}`];
}

function gitSpecifier(source: GitPluginSource): string {
  return source.ref === undefined ? source.url : `${source.url}#${source.ref}`;
}

function assertSuccessfulGitCommand(label: string, result: GitCommandResult): void {
  if (result.exitCode === 0) return;

  const output = [result.stderr.trim(), result.stdout.trim()].filter((part) => part.length > 0).join("\n");
  const suffix = output.length > 0 ? ` Output:\n${output}` : "";
  throw new GitPluginFetchError(`${label} failed with exit code ${result.exitCode}.${suffix}`);
}

function normalizeResolvedCommit(stdout: string): string | undefined {
  const firstLine = stdout.trim().split("\n")[0];
  return firstLine === undefined || firstLine.length === 0 ? undefined : firstLine;
}

function buildMetadata(source: GitPluginSource, resolvedCommit: string | undefined): GitPluginInstallMetadata {
  return source.ref === undefined
    ? { requestedUrl: source.url, resolvedCommit }
    : { requestedUrl: source.url, requestedRef: source.ref, resolvedCommit };
}

async function commitDirectory(fs: GitPluginInstallerFileSystem, from: string, to: string): Promise<void> {
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

async function moveExistingEntryAside(fs: GitPluginInstallerFileSystem, from: string, backup: string): Promise<boolean> {
  try {
    await fs.rename(from, backup);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return false;
    throw error;
  }
}

async function moveDirectoryAcrossDevices(fs: GitPluginInstallerFileSystem, from: string, to: string): Promise<void> {
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

const nodeFileSystem: GitPluginInstallerFileSystem = {
  mkdir: async (path, options) => { void await mkdir(path, options); },
  mkdtemp,
  rename,
  rm,
  cp,
  writeFile,
};

const defaultGitCommandRunner: GitCommandRunner = async (command, args, options) => {
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
