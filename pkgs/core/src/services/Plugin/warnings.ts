import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { boxfileConfigStore } from "@boxfiles/config";
import { parsePluginSource, type ParsedPluginSource } from "./source";

export type PluginReproducibilityWarning = {
  readonly pluginId: string;
  readonly source: string;
  readonly reason: string;
};

export async function getPluginReproducibilityWarnings(options: { readonly rootDir: string; readonly fs?: { readonly readFile: (path: string, encoding: "utf8") => Promise<string> } }): Promise<readonly PluginReproducibilityWarning[]> {
  void options;
  const config = await boxfileConfigStore.read();
  return config.plugins.map((plugin) => pluginReproducibilityWarning(plugin.name, plugin.source));
}

export function pluginReproducibilityWarning(pluginId: string, source: string): PluginReproducibilityWarning {
  const parsed = parsePluginSource(source);
  void parsed;
  return { pluginId, source, reason: "reproducibility depends on source availability" };
}
