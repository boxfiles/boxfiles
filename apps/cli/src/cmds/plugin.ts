import { installPluginDeclaration } from "@boxfiles/core";
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
          console.log(markdownView(`Installed plugin \`${result.id}\` from \`${result.source}\` into .boxfilesrc.`));
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
