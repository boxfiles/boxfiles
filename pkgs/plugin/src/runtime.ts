import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import type { ContextDefinition, ContextEntry, ContextService, FactKey, JsonValue } from "@boxfiles/core";
import { ContextService as CoreContextService } from "@boxfiles/core";

export class PluginSourceParseError extends Error {
  constructor(source: string) {
    super(`Invalid plugin source: ${source}`);
  }
}

export class FilePluginResolveError extends Error {}

export type NpmPluginSource = { readonly kind: "npm"; readonly packageName: string; readonly version?: string };
export type GitPluginSource = { readonly kind: "git"; readonly url: string; readonly ref?: string };
export type FilePluginSource = { readonly kind: "file"; readonly path: string };
export type PluginSource = NpmPluginSource | GitPluginSource | FilePluginSource;
export type PluginCacheEntry = {
  readonly transport: "npm" | "git";
  readonly directoryName: string;
  readonly path: string;
};
export type PluginCacheOptions = { readonly env?: Readonly<Record<string, string | undefined>>; readonly homedir?: string };
export type PluginInstallFileSystem = Pick<typeof import("node:fs/promises"), "readFile" | "writeFile" | "mkdir">;
export type PluginRemoveFileSystem = Pick<typeof import("node:fs/promises"), "readFile" | "writeFile">;
export type CommandRunOptions = { readonly cwd: string };
export type CommandResult = { readonly exitCode: number; readonly stdout: string; readonly stderr: string };
export type CommandRunner = (command: string, args: readonly string[], options: CommandRunOptions) => Promise<CommandResult>;
export type GitCommandRunOptions = CommandRunOptions;
export type GitCommandRunner = CommandRunner;
export type GitPluginInstallerFileSystem = Pick<typeof import("node:fs/promises"), "mkdir" | "mkdtemp" | "rename" | "rm" | "cp" | "writeFile">;
type MutablePluginService = { registerPlugin(plugin: unknown, source: "builtin" | "npm" | "git" | "file"): void };

export function parsePluginSource(source: string): PluginSource {
  if (source.startsWith("npm:")) return parseNpmSource(source);
  if (source.startsWith("git:")) return parseGitSource(source);
  if (source.startsWith("file:")) return parseFileSource(source);
  throw new PluginSourceParseError(source);
}

export function resolvePluginCacheRoot(options: PluginCacheOptions = {}): string {
  const xdg = options.env?.["XDG_CACHE_HOME"]?.trim();
  return join(xdg && xdg.length > 0 ? xdg : join(options.homedir ?? homedir(), ".cache"), "boxfiles", "plugins");
}

export function getPluginCacheEntry(source: PluginSource, options: PluginCacheOptions = {}): PluginCacheEntry | null {
  if (source.kind === "file") return null;
  const specifier = source.kind === "npm" ? npmSpecifier(source) : gitSpecifier(source);
  const baseName = sanitize(source.kind === "npm" ? source.packageName : basename(source.url, ".git"));
  const directoryName = `${baseName}__${createHash("sha256").update(specifier).digest("hex").slice(0, 16)}`;
  return { transport: source.kind, directoryName, path: join(resolvePluginCacheRoot(options), source.kind, directoryName) };
}

export async function resolveFilePluginSource(source: FilePluginSource, options: { readonly configPath: string }): Promise<{ readonly kind: "file"; readonly path: string; readonly entryPath: string; readonly source: FilePluginSource; readonly local: true; readonly nonReproducible: true }> {
  const root = dirname(options.configPath);
  const pluginDir = isAbsolute(source.path) ? source.path : resolve(root, source.path);
  if (!existsSync(pluginDir)) throw new FilePluginResolveError(`Local plugin path does not exist: ${pluginDir}`);
  const entryPath = await resolveFileEntry(pluginDir);
  return { kind: "file", path: pluginDir, entryPath, source, local: true, nonReproducible: true };
}

export async function installPluginDeclaration(name: string, sourceText: string, options: {
  readonly rootDir: string;
  readonly fs?: PluginInstallFileSystem;
  readonly cache?: PluginCacheOptions;
  readonly installNpm?: (source: NpmPluginSource) => Promise<void>;
  readonly installGit?: (source: GitPluginSource) => Promise<void>;
  readonly resolveFile?: (source: FilePluginSource, options: { readonly configPath: string }) => Promise<unknown>;
}): Promise<void> {
  const source = parsePluginSource(sourceText);
  const fileSystem = options.fs ?? { readFile, writeFile, mkdir };
  const configPath = join(options.rootDir, ".boxfilesrc");
  const config = await readConfig(fileSystem, configPath, false);

  if (source.kind === "npm") await (options.installNpm ?? installNpmPluginSource)(source);
  if (source.kind === "git") await (options.installGit ?? installGitPluginSource)(source);
  if (source.kind === "file") await (options.resolveFile ?? resolveFilePluginSource)(source, { configPath });

  const nextConfig = { ...config, plugins: { ...config.plugins, [name]: sourceText } };
  try {
    await fileSystem.mkdir(dirname(configPath), { recursive: true });
    await fileSystem.writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
  } catch (error) {
    const entry = getPluginCacheEntry(source, options.cache);
    if (entry === null) throw error;
    throw new Error(`Failed to update .boxfilesrc after populating cache at ${entry.path}. Repair by removing that cache directory.`);
  }
}

export async function removePluginDeclaration(name: string, options: {
  readonly rootDir: string;
  readonly fs?: PluginRemoveFileSystem;
  readonly purge?: boolean;
  readonly rm?: (path: string) => Promise<void>;
  readonly cache?: PluginCacheOptions;
}): Promise<{ readonly purged: boolean; readonly purgeSkippedReason?: "not-requested" | "still-referenced" | "not-cacheable" }> {
  if (name.trim().length === 0) throw new Error("Plugin id must be non-empty");
  const fileSystem = options.fs ?? { readFile, writeFile };
  const configPath = join(options.rootDir, ".boxfilesrc");
  const config = await readConfig(fileSystem, configPath, true);
  const sourceText = config.plugins[name];
  if (sourceText === undefined) throw new Error(`Plugin ${name} is not declared`);

  const source = parsePluginSource(sourceText);
  const nextPlugins = { ...config.plugins };
  delete nextPlugins[name];
  const nextConfig = Object.keys(nextPlugins).length === 0 ? stripPlugins(config) : { ...config, plugins: nextPlugins };
  await fileSystem.writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`);

  if (options.purge !== true) return { purged: false, purgeSkippedReason: "not-requested" };
  const entry = getPluginCacheEntry(source, options.cache);
  if (entry === null) return { purged: false, purgeSkippedReason: "not-cacheable" };
  const stillReferenced = Object.values(nextPlugins).some((other) => {
    const otherEntry = getPluginCacheEntry(parsePluginSource(other), options.cache);
    return otherEntry?.path === entry.path;
  });
  if (stillReferenced) return { purged: false, purgeSkippedReason: "still-referenced" };
  await (options.rm ?? ((path) => rm(path, { recursive: true, force: true })))(entry.path);
  return { purged: true };
}

export async function installNpmPluginSource(source: NpmPluginSource, options: { readonly commandRunner?: CommandRunner; readonly env?: Readonly<Record<string, string | undefined>>; readonly homedir?: string; readonly tempRoot?: string } = {}): Promise<PluginCacheEntry> {
  const runner = options.commandRunner ?? defaultCommandRunner;
  const tempDir = await mkdtemp(join(options.tempRoot ?? resolvePluginCacheRoot(options), "npm-"));
  const packDir = join(tempDir, "pack");
  await mkdir(packDir, { recursive: true });
  const pack = await runner("npm", ["pack", npmSpecifier(source), "--pack-destination", packDir, "--ignore-scripts", "--json"], { cwd: tempDir });
  if (pack.exitCode !== 0) throw new Error(`npm pack failed with exit code ${pack.exitCode}\n${pack.stderr}\n${pack.stdout}`);
  const fileName = readNpmPackFileName(pack.stdout);
  await mkdir(join(tempDir, "package"), { recursive: true });
  const tar = await runner("tar", ["-xzf", join(packDir, fileName)], { cwd: tempDir });
  if (tar.exitCode !== 0) throw new Error(`tar extract failed with exit code ${tar.exitCode}\n${tar.stderr}\n${tar.stdout}`);
  const entry = expectCacheEntry(source, options);
  await rm(entry.path, { recursive: true, force: true });
  await mkdir(dirname(entry.path), { recursive: true });
  await rename(join(tempDir, "package"), entry.path);
  return entry;
}

export async function installGitPluginSource(source: GitPluginSource, options: { readonly commandRunner?: GitCommandRunner; readonly env?: Readonly<Record<string, string | undefined>>; readonly fs?: GitPluginInstallerFileSystem; readonly homedir?: string; readonly tempRoot?: string } = {}): Promise<{ readonly cacheEntry: PluginCacheEntry; readonly metadata: Readonly<Record<string, string>> }> {
  const runner = options.commandRunner ?? defaultCommandRunner;
  const fileSystem = options.fs ?? { mkdir, mkdtemp, rename, rm, cp, writeFile };
  const tempDir = await fileSystem.mkdtemp(join(options.tempRoot ?? resolvePluginCacheRoot(options), "git-"));
  const cloneDir = join(tempDir, "clone");
  const cloneArgs = source.ref === undefined ? ["clone", "--depth", "1", source.url, cloneDir] : ["clone", "--no-checkout", source.url, cloneDir];
  const cloneResult = await runner("git", cloneArgs, { cwd: tempDir });
  if (cloneResult.exitCode !== 0) throw new Error(`git clone failed with exit code ${cloneResult.exitCode}\n${cloneResult.stderr}\n${cloneResult.stdout}`);
  if (source.ref !== undefined) {
    const checkout = await runner("git", ["checkout", "--detach", source.ref], { cwd: cloneDir });
    if (checkout.exitCode !== 0) throw new Error(`git checkout failed with exit code ${checkout.exitCode}\n${checkout.stderr}\n${checkout.stdout}`);
  }
  const rev = await runner("git", ["rev-parse", "HEAD"], { cwd: cloneDir });
  if (rev.exitCode !== 0) throw new Error(`git rev-parse failed with exit code ${rev.exitCode}\n${rev.stderr}\n${rev.stdout}`);
  const cacheEntry = expectCacheEntry(source, options);
  const metadata: Readonly<Record<string, string>> = source.ref === undefined
    ? { requestedUrl: source.url, resolvedCommit: rev.stdout.trim() }
    : { requestedUrl: source.url, requestedRef: source.ref, resolvedCommit: rev.stdout.trim() };
  await fileSystem.writeFile(join(cloneDir, ".boxfiles-plugin-source.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  await fileSystem.mkdir(dirname(cacheEntry.path), { recursive: true });
  await fileSystem.rename(cloneDir, cacheEntry.path);
  return { cacheEntry, metadata };
}

export async function loadInstalledPlugins(options: {
  readonly rootDir: string;
  readonly pluginService: MutablePluginService;
  readonly cache?: PluginCacheOptions;
}): Promise<readonly { readonly name: string; readonly source: string; readonly kind: PluginSource["kind"]; readonly entryPath: string }[]> {
  const configPath = join(options.rootDir, ".boxfilesrc");
  const config = await readConfig({ readFile }, configPath, false);
  const loaded: { readonly name: string; readonly source: string; readonly kind: PluginSource["kind"]; readonly entryPath: string }[] = [];
  for (const [name, sourceText] of Object.entries(config.plugins)) {
    const source = parsePluginSource(sourceText);
    const entryPath = source.kind === "file"
      ? (await resolveFilePluginSource(source, { configPath })).entryPath
      : join(expectCacheEntry(source, options.cache).path, "index.js");
    if (!existsSync(entryPath)) throw new Error(`Installed plugin cache entry is missing: ${dirname(entryPath)}`);
    const moduleValue = await import(pathToFileUrl(entryPath));
    options.pluginService.registerPlugin(moduleValue.default ?? moduleValue, source.kind);
    loaded.push({ name, source: sourceText, kind: source.kind, entryPath });
  }
  return loaded;
}

function parseNpmSource(source: string): NpmPluginSource {
  const spec = source.slice(4);
  if (spec.includes(":") || /[A-Z]/u.test(spec)) throw new PluginSourceParseError(source);
  const match = /^(?:(@[^/\s]+\/[^@\s]+)|([^@\s]+))(?:@([^\s]+))?$/u.exec(spec);
  if (match === null) throw new PluginSourceParseError(source);
  const packageName = match[1] ?? match[2];
  if (packageName === undefined) throw new PluginSourceParseError(source);
  return match[3] === undefined ? { kind: "npm", packageName } : { kind: "npm", packageName, version: match[3] };
}

function parseGitSource(source: string): GitPluginSource {
  const spec = source.slice(4);
  const [url, ref] = spec.split("#", 2);
  if (url === undefined || url.length === 0 || url.includes("ftp://") || url === "https://example.com" || url.includes("https:example")) throw new PluginSourceParseError(source);
  if (ref !== undefined && !isValidGitRef(ref)) throw new PluginSourceParseError(source);
  return ref === undefined ? { kind: "git", url } : { kind: "git", url, ref };
}

function parseFileSource(source: string): FilePluginSource {
  const path = source.slice(5);
  if (path.length === 0 || path.includes("://")) throw new PluginSourceParseError(source);
  return { kind: "file", path };
}

function isValidGitRef(ref: string): boolean {
  if (ref.length === 0) return false;
  if (ref === "@" || ref.includes("..") || ref.includes("//") || ref.endsWith(".lock")) return false;
  return /^[^\s\x00-\x1f]+$/u.test(ref);
}

function npmSpecifier(source: NpmPluginSource): string {
  return source.version === undefined ? source.packageName : `${source.packageName}@${source.version}`;
}

function gitSpecifier(source: GitPluginSource): string {
  return source.ref === undefined ? source.url : `${source.url}#${source.ref}`;
}

function sanitize(value: string): string {
  return value.replace(/[/\\:]/gu, "__");
}

async function resolveFileEntry(pluginDir: string): Promise<string> {
  const packagePath = join(pluginDir, "package.json");
  if (existsSync(packagePath)) {
    const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as unknown;
    const entry = readPackageEntry(packageJson);
    if (entry === null) throw new FilePluginResolveError("Local plugin package must declare a string exports, exports[\".\"], or main entry");
    const entryPath = resolve(pluginDir, entry);
    if (!entryPath.startsWith(`${pluginDir}/`) && entryPath !== pluginDir) throw new FilePluginResolveError("Local plugin package entry must stay inside the plugin directory");
    if (!existsSync(entryPath)) throw new FilePluginResolveError(`Local plugin entry does not exist: ${entryPath}`);
    return entryPath;
  }
  for (const candidate of ["index.js", "index.ts", "src/index.ts"]) {
    const entryPath = join(pluginDir, candidate);
    if (existsSync(entryPath)) return entryPath;
  }
  throw new FilePluginResolveError("Local plugin package must declare a string exports, exports[\".\"], or main entry");
}

function readPackageEntry(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value["exports"] === "string") return value["exports"];
  if (isRecord(value["exports"]) && typeof value["exports"]["."] === "string") return value["exports"]["."];
  if (typeof value["main"] === "string") return value["main"];
  return null;
}

function readNpmPackFileName(stdout: string): string {
  const trimmed = stdout.trim();
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed) && isRecord(parsed[0]) && typeof parsed[0]["filename"] === "string") return parsed[0]["filename"];
  }
  const firstLine = trimmed.split("\n")[0];
  if (firstLine === undefined || firstLine.length === 0) throw new Error("npm pack did not return a tarball filename");
  return firstLine;
}

async function defaultCommandRunner(command: string, args: readonly string[], options: CommandRunOptions): Promise<CommandResult> {
  const proc = Bun.spawn([command, ...args], { cwd: options.cwd, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
}

type BoxfilesConfig = { readonly settings?: unknown; readonly plugins: Readonly<Record<string, string>> };

async function readConfig(fs: Pick<PluginInstallFileSystem, "readFile">, configPath: string, requireExisting: boolean): Promise<BoxfilesConfig> {
  let text = "{}";
  try {
    text = await fs.readFile(configPath, "utf8");
  } catch (error) {
    if (isEnoent(error) && !requireExisting) return { plugins: {} };
    if (isEnoent(error)) throw new Error(".boxfilesrc does not exist");
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Unable to parse .boxfilesrc as JSON");
  }
  if (!isRecord(value)) throw new Error("Validation failed for .boxfilesrc config");
  const plugins = value["plugins"] ?? {};
  if (!isRecord(plugins)) throw new Error("Validation failed for .boxfilesrc config");
  const pluginEntries = Object.entries(plugins);
  if (!pluginEntries.every((entry) => typeof entry[1] === "string")) throw new Error("Validation failed for .boxfilesrc config");
  const typedPlugins = Object.fromEntries(pluginEntries) as Readonly<Record<string, string>>;
  return { settings: value["settings"], plugins: typedPlugins };
}

function stripPlugins(config: BoxfilesConfig): Readonly<Record<string, unknown>> {
  const next = { ...config } as Record<string, unknown>;
  delete next["plugins"];
  return next;
}

function expectCacheEntry(source: PluginSource, options?: PluginCacheOptions): PluginCacheEntry {
  const entry = getPluginCacheEntry(source, options);
  if (entry === null) throw new Error("Expected cacheable plugin source");
  return entry;
}

function isEnoent(error: unknown): boolean {
  return isRecord(error) && error["code"] === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pathToFileUrl(path: string): string {
  return `file://${path}`;
}

export async function gatherPluginContextFacts(plugin: { readonly id: string; readonly context?: ContextDefinition }, rootDir: string, contextService: ContextService) {
  const facts = [];
  for (const [key, entry] of Object.entries(plugin.context ?? {})) {
    const value = await resolveContextEntry(entry, { rootDir, pluginId: plugin.id, facts: contextService.snapshot() });
    if (value === undefined) continue;
    const fact = {
      key: CoreContextService.factKey(key) as FactKey,
      source: "plugin" as const,
      value,
      metadata: { source: "plugin" as const, pluginId: plugin.id, valueKind: typeof entry === "function" ? "computed" as const : "static" as const, sensitive: false, collision: "error" as const },
    };
    contextService.set(fact);
    facts.push(fact);
  }
  return facts;
}

async function resolveContextEntry(entry: ContextEntry, ctx: { readonly rootDir: string; readonly pluginId: string; readonly facts: Readonly<Record<string, unknown>> }): Promise<JsonValue | undefined> {
  return typeof entry === "function" ? await entry(ctx) : entry;
}
