import { configDir, createStore, field } from "@crustjs/store";
import {
  BoxfileConfigPluginSchemaArray,
  BoxfileConfigSettingsSchema,
} from "./schema";
import { Compile } from "@sinclair/typemap";

export const boxfileConfigStore = createStore({
  dirPath: configDir("boxfiles"),
  name: "config",
  fields: {
    plugins: field(Compile(BoxfileConfigPluginSchemaArray), {}),
    settings: field(Compile(BoxfileConfigSettingsSchema), {}),
  },
  access: "default",
});

export type BoxfileConfigStore = typeof boxfileConfigStore;
export type BoxfileConfigState = Awaited<
  ReturnType<BoxfileConfigStore["read"]>
>;
