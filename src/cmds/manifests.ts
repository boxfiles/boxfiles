import * as path from "node:path";
import { app } from "../app";
import { manifestIdFromPath, ManifestService } from "../services/Manifest";
import { PluginService } from "../services/Plugins";
import { markdownView } from "../views/markdown";

export const manifestCmd = app
  .sub("manifests")
  .meta({
    description: "Inspect discovered boxfile manifests.",
  })
  .command("files", (cmd) =>
    cmd
      .meta({
        description: "List discovered boxfile manifest files.",
      })
      .run(async ({ flags }) => {
        await listManifestFiles(flags.dir);
      }),
  )
  .command("plan", (cmd) =>
    cmd
      .meta({
        description: "Show planned manifest list.",
      })
      .run(() => {
        throw new Error("Not implemented yet.");
      }),
  );

async function listManifestFiles(rootDir: string): Promise<void> {
  const pluginService = new PluginService(rootDir);
  const manifestService = new ManifestService(rootDir, pluginService);
  const manifestPaths = await manifestService.discover();
  const rows = manifestPaths.map((manifestPath) => {
    const relativePath = path.relative(rootDir, manifestPath);
    const id = manifestIdFromPath(rootDir, manifestPath);

    return {
      id,
      path: relativePath,
    };
  });

  if (rows.length === 0) {
    console.log("No manifests found.");
    return;
  }

  console.log(
    markdownView(
      [
        "## Discovered Manifests\n",
        ...rows.map((row) => `- [${row.id}](${row.path})`),
      ].join("\n"),
    ),
  );
}

