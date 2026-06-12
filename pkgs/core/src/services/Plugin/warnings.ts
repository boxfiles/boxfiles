// warnings.ts
//
// Surfaces reproducibility gaps for declared plugin sources until lockfiles
// exist. Warnings are generated from `.boxfilesrc` only; this module does not
// inspect cache contents or contact npm/git.
//
// This keeps warnings cheap enough to attach to plan-oriented CLI output while
// matching runtime semantics: planning uses installed cache artifacts for
// remote plugins and live paths for file plugins.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readBoxfilesRcConfig } from "../Config";
import { parsePluginSource, type ParsedPluginSource } from "./source";

export type PluginReproducibilityWarning = {
  readonly id: string;
  readonly source: string;
  readonly kind: ParsedPluginSource["kind"];
  readonly message: string;
};

export type PluginWarningsFileSystem = {
  readonly readFile: (path: string, encoding: "utf8") => Promise<string>;
};

export type PluginWarningsOptions = {
  readonly rootDir: string;
  readonly fs?: PluginWarningsFileSystem;
};

const nodeFileSystem: PluginWarningsFileSystem = {
  readFile,
};

/**
 * Reads plugin declarations and returns source-level warnings. Missing config is
 * quiet because projects without plugin declarations should not fail commands
 * that merely want optional warnings.
 */
export async function readPluginReproducibilityWarnings(
  options: PluginWarningsOptions,
): Promise<readonly PluginReproducibilityWarning[]> {
  const fs = options.fs ?? nodeFileSystem;
  const configPath = join(options.rootDir, ".boxfilesrc");
  const config = await readBoxfilesRcConfig(configPath, { fs });
  return config.plugins.map((plugin) => pluginReproducibilityWarning(plugin.name, plugin.source));
}

export function pluginReproducibilityWarning(
  id: string,
  sourceText: string,
): PluginReproducibilityWarning {
  const source = parsePluginSource(sourceText);
  return {
    id,
    source: sourceText,
    kind: source.kind,
    message: warningMessage(source),
  };
}

export function formatPluginReproducibilityWarnings(
  warnings: readonly PluginReproducibilityWarning[],
): string {
  if (warnings.length === 0) return "";

  const lines = ["## Plugin Reproducibility Warnings", ""];
  for (const warning of warnings) {
    lines.push(`- \`${warning.id}\` (${warning.kind}): ${warning.message}`);
  }

  return lines.join("\n");
}

// Warning text mirrors current runtime behavior, not future lockfile goals:
// npm/git planning reads cache artifacts after install; file planning reads the
// local path directly.
function warningMessage(source: ParsedPluginSource): string {
  if (source.kind === "npm") {
    if (source.version === undefined) {
      return "npm source has no version spec. It is floating and unlocked until plugin lockfiles exist; planning uses the cached artifact, not live npm.";
    }

    return "npm source is not integrity-locked yet. It remains non-reproducible until plugin lockfiles exist; planning uses the cached artifact, not live npm.";
  }

  if (source.kind === "git") {
    if (source.ref === undefined) {
      return "git source has no ref. It follows the remote default branch and is unlocked until plugin lockfiles exist; planning uses the cached artifact, not live git.";
    }

    return "git source ref is not commit-locked or integrity-locked yet. It remains non-reproducible until plugin lockfiles exist; planning uses the cached artifact, not live git.";
  }

  return "file source is local machine state. It is not reproducible across workstations; planning uses the local path directly.";
}
