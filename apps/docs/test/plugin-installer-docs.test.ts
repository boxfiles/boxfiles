import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const pluginInstallerPath = "apps/docs/content/plugin-installer.md";
const indexPath = "apps/docs/content/index.md";
const pluginsPath = "apps/docs/content/plugins.md";

describe("plugin installer docs", () => {
  test("covers installer source, cache, removal, lockfile, and trust topics", async () => {
    const content = await readFile(pluginInstallerPath, "utf8");

    for (const requiredText of requiredPluginInstallerTopics) {
      expect(content).toContain(requiredText);
    }
  });

  test("is linked from docs index and plugins overview", async () => {
    const index = await readFile(indexPath, "utf8");
    const plugins = await readFile(pluginsPath, "utf8");

    expect(index).toContain("[Plugin installer](./plugin-installer.md)");
    expect(plugins).toContain("[Plugin installer](./plugin-installer.md)");
  });
});

const requiredPluginInstallerTopics = [
  "`.boxfilesrc`",
  "plugin install",
  "`npm:`",
  "`git:`",
  "`file:`",
  "$XDG_CACHE_HOME/boxfiles/plugins/{transport}/{name}__{hash}/",
  "plugin remove",
  "--purge",
  "Lockfile support is deferred",
  "does not sandbox third-party code",
] as const;
