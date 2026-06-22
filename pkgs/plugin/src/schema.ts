import Type from "typebox";
import Schema from "typebox/schema";
import { ContextDefinitionSchema } from "@boxfiles/core";
import { PluginModuleShapeError } from "./errors";
import type { BoxfilePlugin } from "./plugin";

export type PluginModule = { readonly default?: unknown };

export const PluginSchema = Type.Object({
  id: Type.Readonly(Type.String()),
  context: Type.Readonly(Type.Optional(ContextDefinitionSchema)),
  actions: Type.Readonly(
    Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  ),
});

export const PluginModuleSchema = Type.Union([
  PluginSchema,
  Type.Object({ default: PluginSchema }),
]);

const PluginModuleParser = Schema.Compile(PluginModuleSchema);

export function normalizePluginModule(moduleValue: unknown): BoxfilePlugin {
  const candidate = isModuleWrapper(moduleValue)
    ? moduleValue["default"]
    : moduleValue;
  return parsePluginModule(candidate);
}

export function parsePluginModule(moduleValue: unknown): BoxfilePlugin {
  try {
    return PluginModuleParser.Parse(moduleValue) as BoxfilePlugin;
  } catch {
    throw new PluginModuleShapeError();
  }
}

function isModuleWrapper(value: unknown): value is PluginModule {
  return typeof value === "object" && value !== null && "default" in value;
}
