import Type from "typebox";

export const BoxfileConfigPluginSourceSchema = Type.Readonly(
  Type.Union([
    Type.String({ pattern: "^npm:\\S+$" }),
    Type.String({ pattern: "^git:\\S+$" }),
    Type.String({ pattern: "^file:\\S+$" }),
  ]),
);

export const BoxfileConfigPluginSchema = Type.Object({
  name: Type.Readonly(Type.String({ minLength: 1 })),
  source: BoxfileConfigPluginSourceSchema,
});

export const BoxfileConfigPluginSchemaArray = Type.Readonly(
  Type.Array(BoxfileConfigPluginSchema, { default: [] }),
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
export type BoxfileConfigPlugin = Type.Static<typeof BoxfileConfigPluginSchema>;
export type BoxfileConfig = Type.Static<typeof BoxfileConfigSchema>;
