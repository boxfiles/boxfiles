import Type from "typebox";
import { NonBlankStringSchema } from "../../common/schema";

export const PluginDeclarationNameSchema = Type.Readonly(NonBlankStringSchema);
export const PluginDeclarationSourceSchema = Type.Readonly(Type.Union([
  Type.String({
    pattern: "^npm:\\S+$",
    description: "NPM plugin source shorthand, for example npm:@scope/plugin@1.2.3.",
  }),
  Type.String({
    pattern: "^git:\\S+$",
    description: "Git plugin source shorthand, for example git:https://example.com/org/repo.git#tag.",
  }),
  Type.String({
    pattern: "^file:\\S+$",
    description: "Local plugin source shorthand, for example file:./plugins/example.",
  }),
]));

export const PluginDeclarationMapSchema = Type.Readonly(
  Type.Unsafe<Readonly<Record<string, Type.Static<typeof PluginDeclarationSourceSchema>>>>({
    type: "object",
    propertyNames: NonBlankStringSchema,
    additionalProperties: PluginDeclarationSourceSchema,
    description: "Map of local plugin names to source strings. Sources are accepted as strings for a future resolver.",
  }),
);

const FactCollisionPolicySchema = Type.Union([
  Type.Literal("error"),
  Type.Literal("override"),
  Type.Literal("keep-first"),
]);

export const BoxfilesRcFileSchema = Type.Object(
  {
    plugins: Type.Readonly(Type.Optional(PluginDeclarationMapSchema)),
    settings: Type.Readonly(Type.Optional(Type.Object(
      {
        facts: Type.Readonly(Type.Optional(Type.Object(
          {
            collision: Type.Readonly(Type.Optional(FactCollisionPolicySchema)),
          },
          {
            additionalProperties: false,
            description: "Default collision policy for facts loaded from this config file.",
          },
        ))),
        plugins: Type.Readonly(Type.Optional(Type.Object(
          {
            allowRemote: Type.Readonly(Type.Optional(Type.Boolean({
              description: "Whether remote plugin references may be loaded from this config.",
            }))),
          },
          {
            additionalProperties: false,
            description: "Plugin-loading policy hints for this config file.",
          },
        ))),
      },
      {
        additionalProperties: false,
        description: "Config-level settings that affect fact collision handling and plugin loading.",
      },
    ))),
  },
  {
    title: "Boxfiles rc config",
    description: "Project or user config for plugins and settings loaded from .boxfilesrc files.",
    additionalProperties: false,
  },
);

export const NormalizedPluginDeclarationSchema = Type.Object({
  name: PluginDeclarationNameSchema,
  source: PluginDeclarationSourceSchema,
});

export type BoxfilesRcFileDto = Type.Static<typeof BoxfilesRcFileSchema>;
export type NormalizedPluginDeclarationDto = Type.Static<typeof NormalizedPluginDeclarationSchema>;
export type BoxfilesRcConfigDto = Omit<BoxfilesRcFileDto, "plugins"> & {
  readonly plugins: readonly NormalizedPluginDeclarationDto[];
};
