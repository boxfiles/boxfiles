import { app } from "../app";
import { getActiveRuntime } from "../runtime";
  import {
  RuntimeRootMismatchError,
  formatCommandError,
  markdownView,
} from "@zenobius/boxfiles-core";

export const pluginsCmd = app
  .sub("plugins")
  .meta({
    description: "Inspect available boxfile plugins.",
  })
  .command("list", (cmd) =>
    cmd
      .meta({
        description: "List registered plugins and action providers.",
      })
      .run((input) => {
        runPluginsCommand(() => {
          listPlugins(input.flags.dir);
        });
      }),
  )
  .run((input) => {
    runPluginsCommand(() => {
      listPlugins(input.flags.dir);
    });
  });

function runPluginsCommand(command: () => void): void {
  try {
    command();
  } catch (error) {
    process.exitCode = 1;
    console.error(formatCommandError(error));
  }
}

function listPlugins(rootDir: string): void {
  const runtime = getActiveRuntime();
  if (runtime.pluginService.rootDir !== rootDir) {
    throw new RuntimeRootMismatchError(rootDir, runtime.pluginService.rootDir);
  }

  const plugins = runtime.pluginService.listPlugins();
  if (plugins.length === 0) {
    console.log("No plugins registered.");
    return;
  }

  const rows = plugins.map((plugin) => {
    const context =
      plugin.contextKeys.length === 0
        ? "none"
        : plugin.contextKeys.map((key) => `\`${key}\``).join(", ");
    const actions =
      plugin.actionKinds.length === 0
        ? "none"
        : plugin.actionKinds.map((kind) => `\`${kind}\``).join(", ");

    return `| \`${plugin.id}\` | ${plugin.source} | ${context} | ${actions} |`;
  });

  console.log(
    markdownView(
      [
        "## Plugins",
        "",
        "| Plugin | Source | Context facts | Action providers |",
        "|---|---|---|---|",
        ...rows,
      ].join("\n"),
    ),
  );
}
