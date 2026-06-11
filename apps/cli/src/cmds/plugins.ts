import { app } from "../app";
import { formatCommandError } from "../common/console";
import { getActiveRuntime } from "../runtime";
import { RuntimeRootMismatchError, formatPluginReproducibilityWarnings, readPluginReproducibilityWarnings } from "@boxfiles/core";
import { markdownView } from "../views/markdown";

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
      .run(async (input) => {
        await runPluginsCommand(async () => {
          await listPlugins(input.flags.dir);
        });
      }),
  )
  .run(async (input) => {
    await runPluginsCommand(async () => {
      await listPlugins(input.flags.dir);
    });
  });

async function runPluginsCommand(command: () => Promise<void>): Promise<void> {
  try {
    await command();
  } catch (error) {
    process.exitCode = 1;
    console.error(formatCommandError(error));
  }
}

async function listPlugins(rootDir: string): Promise<void> {
  const runtime = getActiveRuntime();
  if (runtime.pluginService.rootDir !== rootDir) {
    throw new RuntimeRootMismatchError(rootDir, runtime.pluginService.rootDir);
  }

  const plugins = runtime.pluginService.listPlugins();
  const warnings = await readPluginReproducibilityWarnings({ rootDir });
  const warningSection = formatPluginReproducibilityWarnings(warnings);
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

  const sections = [
    [
      "## Plugins",
      "",
      "| Plugin | Source | Context facts | Action providers |",
      "|---|---|---|---|",
      ...rows,
    ].join("\n"),
  ];

  if (warningSection.length > 0) sections.push(warningSection);

  console.log(markdownView(sections.join("\n\n")));
}
