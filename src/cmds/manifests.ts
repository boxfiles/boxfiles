import * as path from "node:path";
import { app } from "../app";
import { manifestIdFromPath, ManifestService } from "../services/Manifest";
import { PluginService } from "../services/Plugins";
import { fileTreeView } from "../views/markdown";

const manifestArgs = [
  {
    name: "manifest",
    type: "string",
    description:
      "Optional manifest id to list from, e.g. desktop or desktop.shell.",
  },
] as const;

export const manifestCmd = app
  .sub("manifests")
  .meta({
    description: "List discovered boxfile manifests.",
  })
  .args(manifestArgs)
  .run(async ({ args, flags }) => {
    const rootDir = flags.dir;
    const pluginService = new PluginService(rootDir);
    const manifestService = new ManifestService(rootDir, pluginService);
    const manifestPaths = await manifestService.discover();
    const targetManifest = args.manifest;
    const rows = manifestPaths
      .map((manifestPath) => {
        const relativePath = path.relative(rootDir, manifestPath);
        const id = manifestIdFromPath(rootDir, manifestPath);

        return {
          id,
          path: relativePath,
          label: `${path.basename(relativePath)} (${id})`,
        };
      })
      .filter((manifest) => isRequestedManifest(manifest.id, targetManifest));

    if (rows.length === 0) {
      console.log("No manifests found.");
      return;
    }

    console.log(fileTreeView(rows));
  });

function isRequestedManifest(
  manifestId: string,
  requestedManifest: string | undefined,
): boolean {
  if (requestedManifest === undefined) return true;

  const requested = requestedManifest.trim();
  if (requested.length === 0) return true;

  return manifestId === requested || manifestId.startsWith(`${requested}.`);
}