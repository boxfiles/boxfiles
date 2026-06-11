import { formatPluginReproducibilityWarnings, installPluginDeclaration, removePluginDeclaration, type PluginRemoveResult, type PluginReproducibilityWarning } from "@boxfiles/core";
import { app } from "../app";
import { formatCommandError } from "../common/console";
import { markdownView } from "../views/markdown";

export const pluginCmd = app
  .sub("plugin")
  .meta({
    description: "Manage boxfile plugins.",
  })
  .command("install", (cmd) =>
    cmd
      .meta({
        description: "Install a plugin source and record it in .boxfilesrc.",
      })
      .args([
        { name: "id", type: "string" },
        { name: "source", type: "string" },
      ])
      .run(async (input) => {
        try {
          const id = readStringArg(input.args, "id");
          const source = readStringArg(input.args, "source");
          const result = await installPluginDeclaration(id, source, { rootDir: input.flags.dir });
          console.log(markdownView(formatInstallSuccess(result.id, result.source, result.warning)));
        } catch (error) {
          process.exitCode = 1;
          console.error(markdownView(formatCommandError(error)));
        }
      }),
  )
  .command("remove", (cmd) =>
    cmd
      .meta({
        description: "Remove a plugin declaration from .boxfilesrc.",
      })
      .flags({
        purge: {
          type: "boolean",
          default: false,
          description: "Also delete the plugin cache entry when no remaining declaration references it.",
        },
      })
      .args([
        { name: "id", type: "string" },
      ])
      .run(async (input) => {
        try {
          const id = readStringArg(input.args, "id");
          const result = await removePluginDeclaration(id, { rootDir: input.flags.dir, purge: readBooleanFlag(input.flags, "purge") });
          console.log(markdownView(formatRemoveSuccess(result)));
        } catch (error) {
          process.exitCode = 1;
          console.error(markdownView(formatCommandError(error)));
        }
      }),
  );

function readStringArg(args: unknown, name: string): string {
  if (!isRecord(args)) throw new Error(`Missing required argument ${name}.`);
  const value = args[name];
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(`Missing required argument ${name}.`);
}

function readBooleanFlag(flags: unknown, name: string): boolean {
  if (!isRecord(flags)) return false;
  return flags[name] === true;
}

function formatInstallSuccess(id: string, source: string, warning: PluginReproducibilityWarning): string {
  return [
    `Installed plugin \`${id}\` from \`${source}\` into .boxfilesrc.`,
    "",
    formatPluginReproducibilityWarnings([warning]),
  ].join("\n");
}
function formatRemoveSuccess(result: PluginRemoveResult): string {
  if (result.purged) return `Removed plugin \`${result.id}\` from .boxfilesrc and purged cache \`${result.cacheEntry?.path ?? ""}\`.`;
  if (result.purgeSkippedReason === "not-cacheable") return `Removed plugin \`${result.id}\` from .boxfilesrc; no cache entry exists for file sources.`;
  if (result.purgeSkippedReason === "still-referenced") return `Removed plugin \`${result.id}\` from .boxfilesrc; kept cache because another declaration still references it.`;
  return `Removed plugin \`${result.id}\` from .boxfilesrc. Cache was kept.`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
