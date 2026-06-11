#!/usr/bin/env bun
import { didYouMeanPlugin, helpPlugin, versionPlugin } from "@crustjs/plugins";
import { app } from "./app";
import { manifestCmd } from "./cmds/manifests";
import { pluginCmd } from "./cmds/plugin";
import { pluginsCmd } from "./cmds/plugins";
import { schemaCmd } from "./cmds/schema";
import { boxfilesRuntimePlugin } from "./runtime";

const cli = app
  .use(versionPlugin("0.0.0"))
  .use(didYouMeanPlugin({ mode: "help" }))
  .use(helpPlugin())
  .use(boxfilesRuntimePlugin())
  .args([{ name: "cmd", type: "string", variadic: true }])
  .command(manifestCmd)
  .command(pluginCmd)
  .command(pluginsCmd)
  .command(schemaCmd);

await cli.execute({ argv: normalizeGlobalFlags(process.argv.slice(2)) });

function normalizeGlobalFlags(argv: readonly string[]): string[] {
  const globalFlags: string[] = [];
  const remaining: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;

    if (token === "-d" || token === "--dir") {
      const value = argv[index + 1];
      if (value === undefined) {
        remaining.push(token);
        continue;
      }

      globalFlags.push(token, value);
      index += 1;
      continue;
    }

    if (token.startsWith("--dir=")) {
      globalFlags.push(token);
      continue;
    }

    remaining.push(token);
  }

  const commandIndex = remaining.findIndex((token) => !token.startsWith("-"));
  if (commandIndex === -1 || globalFlags.length === 0) return remaining;

  return [...remaining, ...globalFlags];
}
