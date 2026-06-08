import { app } from "../app";
import { builtInPlugins } from "../providers";
import { PluginService } from "../services/Plugins";
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
      .run(({ flags }) => {
        listPlugins(flags.dir);
      }),
  )
  .run(({ flags }) => {
    listPlugins(flags.dir);
  });

function listPlugins(rootDir: string): void {
  const pluginService = new PluginService(rootDir);
  for (const plugin of builtInPlugins) {
    pluginService.registerPlugin(plugin, "builtin");
  }

  const plugins = pluginService.listPlugins();
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
