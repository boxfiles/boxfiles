import { BoxfileConfigSchema, type BoxfileConfig } from "./schema";
import { Provider } from "nconf";
import envPaths from "env-paths";
import { join } from "path";
import { Parse } from "typebox/schema";

class BoxfileConfigStore {
  provider = new Provider();
  store: BoxfileConfig = { plugins: [], settings: {} };
  paths = envPaths("boxfiles", { suffix: "" });

  constructor() {
    this.load();
  }

  load() {
    this.provider
      .file("user", join(this.paths.config, "config.json"))
      .file("project", join(process.cwd(), ".boxfilesrc"))
      .env({
        separator: "__",
        lowerCase: true,
        match: /^BOXFILES__/,
        transform: ({ key }: { key: string; value: string }) => {
          key?.replace(/^BOXFILES__/, "").replace(/__/g, ".");
        },
      })
      .defaults({ plugins: [], settings: {} });

    const value = this.provider.get();
    try {
      this.store = Parse(BoxfileConfigSchema, {
        plugins: value.plugins ?? [],
        settings: value.settings ?? {},
      });
    } catch (error) {
      console.error("Failed to load configuration:", value, error);
    }
  }

  save() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.provider.set(".", this.store);
        this.provider.save(resolve);
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const Config = new BoxfileConfigStore();
