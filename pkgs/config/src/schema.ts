import Type from "typebox";

export const BoxfileConfigPluginSourceSchema = Type.Readonly(
  Type.Union([
    Type.String({ pattern: "^npm:\\S+$" }),
    Type.String({ pattern: "^git:\\S+$" }),
    Type.String({ pattern: "^file:\\S+$" }),
  ]),
);

export const BoxfileConfigPluginSchemaArray = Type.Readonly(
  Type.Array(BoxfileConfigPluginSourceSchema, {
    default: [
      // "npm:@boxfiles/provider-copy",
      // "npm:@boxfiles/provider-gpu",
      // "npm:@boxfiles/provider-link",
      // "npm:@boxfiles/provider-network",
      // "npm:@boxfiles/provider-run",
      // "npm:@boxfiles/provider-ownership",
      // "npm:@boxfiles/provider-os",
      // "npm:@boxfiles/provider-packages",
      // "npm:@boxfiles/provider-permissions",
      // "npm:@boxfiles/provider-remove",
      // "npm:@boxfiles/provider-rename",
    ],
  }),
);
export const BoxfileConfigSettingsSchema = Type.Readonly(
  Type.Optional(
    Type.Object(
      {
        facts: Type.Readonly(
          Type.Optional(
            Type.Object(
              {
                collision: Type.Readonly(
                  Type.Optional(
                    Type.Union([
                      Type.Literal("error"),
                      Type.Literal("override"),
                      Type.Literal("keep-first"),
                    ]),
                  ),
                ),
              },
              { additionalProperties: false },
            ),
          ),
        ),
        plugins: Type.Readonly(
          Type.Optional(
            Type.Object(
              {
                allowRemote: Type.Readonly(Type.Optional(Type.Boolean())),
              },
              { additionalProperties: false },
            ),
          ),
        ),
      },
      { additionalProperties: false },
    ),
  ),
);
export type BoxfileConfigSettings = Type.Static<
  typeof BoxfileConfigSettingsSchema
>;

export const BoxfileConfigSchema = Type.Object(
  {
    plugins: BoxfileConfigPluginSchemaArray,
    settings: BoxfileConfigSettingsSchema,
  },
  { additionalProperties: false },
);

export type BoxfileConfigPluginSource = Type.Static<
  typeof BoxfileConfigPluginSourceSchema
>;
export type BoxfileConfig = Type.Static<typeof BoxfileConfigSchema>;
