import { formatCommandError, formatPluginReproducibilityWarnings, pluginReproducibilityWarning } from "@boxfiles/diagnostics";
import { installPluginDeclaration, removePluginDeclaration } from "@boxfiles/plugin";
import { app } from "../app";

export const pluginCmd = app
  .sub("plugin")
  .command("install", (cmd) => cmd
    .args([
      { name: "name", type: "string" },
      { name: "source", type: "string" },
    ])
    .run(async (context) => {
      const rootDir = readRootDir(context.flags);
      const name = readStringArg(context.args, "name");
      const source = readStringArg(context.args, "source");
      try {
        await installPluginDeclaration(name, source, { rootDir });
        console.log(`Installed plugin ${name}`);
        console.log(formatPluginReproducibilityWarnings([pluginReproducibilityWarning(name, source)]));
      } catch (error) {
        process.exitCode = 1;
        console.error(formatCommandError(error));
      }
    }))
  .command("remove", (cmd) => cmd
    .args([{ name: "name", type: "string" }])
    .flags({ purge: { type: "boolean", default: false } })
    .run(async (context) => {
      const rootDir = readRootDir(context.flags);
      const name = readStringArg(context.args, "name");
      const purge = readBooleanFlag(context.flags, "purge");
      try {
        const result = await removePluginDeclaration(name, { rootDir, purge });
        if (result.purged) {
          console.log(`Removed plugin ${name} and purged cache`);
          return;
        }
        if (result.purgeSkippedReason === "still-referenced") {
          console.log(`Removed plugin ${name}; kept cache because another declaration still references it`);
          return;
        }
        console.log(`Removed plugin ${name}; Cache was kept`);
      } catch (error) {
        process.exitCode = 1;
        console.error(formatCommandError(error));
      }
    }));

function readRootDir(flags: unknown): string {
  if (!isRecord(flags)) return process.cwd();
  const dir = flags["dir"];
  return typeof dir === "string" ? dir : process.cwd();
}

function readStringArg(args: unknown, key: string): string {
  if (!isRecord(args)) throw new Error(`Missing argument: ${key}`);
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`Missing argument: ${key}`);
  return value;
}

function readBooleanFlag(flags: unknown, key: string): boolean {
  if (!isRecord(flags)) return false;
  return flags[key] === true;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
