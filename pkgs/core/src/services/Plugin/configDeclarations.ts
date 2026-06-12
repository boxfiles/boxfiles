import { dirname } from "node:path";
import { BoxfilesRcConfigDTO, type BoxfilesRcConfigDto } from "../Config";

export type PluginDeclarationFileSystem = {
  readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
  readonly writeFile: (path: string, data: string) => Promise<void>;
  readonly mkdir?: (path: string, options?: { readonly recursive?: boolean }) => Promise<void>;
};

export type PluginDeclarationErrorFactory = (message: string) => Error;

export function configDtoToWritablePluginConfig(
  config: BoxfilesRcConfigDto,
): Readonly<Record<string, unknown>> {
  const plugins = Object.fromEntries(config.plugins.map((plugin) => [plugin.name, plugin.source]));
  if (config.settings === undefined && config.plugins.length === 0) return {};
  if (config.plugins.length === 0) return { settings: config.settings };
  if (config.settings === undefined) return { plugins };
  return { settings: config.settings, plugins };
}

export function readPluginDeclarationMap(
  config: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> {
  const plugins = config["plugins"];
  if (plugins === undefined) return {};
  if (!isPlainObject(plugins)) return {};
  return Object.fromEntries(
    Object.entries(plugins).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export async function upsertPluginDeclarationInConfig(
  configPath: string,
  id: string,
  sourceText: string,
  config: Readonly<Record<string, unknown>>,
  fs: PluginDeclarationFileSystem,
): Promise<void> {
  const plugins = readPluginDeclarationMap(config);
  const updated = {
    ...config,
    plugins: {
      ...plugins,
      [id]: sourceText,
    },
  };

  await writePluginConfig(configPath, updated, fs);
}

export async function removePluginDeclarationFromConfig(
  configPath: string,
  plugins: Readonly<Record<string, string>>,
  config: Readonly<Record<string, unknown>>,
  fs: PluginDeclarationFileSystem,
): Promise<void> {
  await writePluginConfig(configPath, buildConfigWithPluginDeclarations(config, plugins), fs);
}

export function omitPluginDeclaration(
  plugins: Readonly<Record<string, string>>,
  id: string,
): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(plugins).filter(([pluginId]) => pluginId !== id));
}

export function assertPluginDeclarationId(
  id: string,
  createError: PluginDeclarationErrorFactory,
): void {
  if (id.trim().length > 0) return;
  throw createError("Plugin id must be non-empty.");
}

export function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function buildConfigWithPluginDeclarations(
  config: Readonly<Record<string, unknown>>,
  plugins: Readonly<Record<string, string>>,
): Readonly<Record<string, unknown>> {
  if (Object.keys(plugins).length > 0) return { ...config, plugins };
  const { plugins: _removed, ...rest } = config;
  void _removed;
  return rest;
}

async function writePluginConfig(
  configPath: string,
  config: Readonly<Record<string, unknown>>,
  fs: PluginDeclarationFileSystem,
): Promise<void> {
  BoxfilesRcConfigDTO.parse(config);
  if (fs.mkdir !== undefined) await fs.mkdir(dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}
