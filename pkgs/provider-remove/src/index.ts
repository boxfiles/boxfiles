import Type from "typebox";
import Schema from "typebox/schema";
import { NonBlankStringSchema } from "@boxfiles/core";
import { type ActionProvider } from "@boxfiles/core";
import { createPlugin } from "@boxfiles/plugin";

const RemoveConfigSchema = Type.Object({
    path: Type.Readonly(NonBlankStringSchema),
    recursive: Type.Readonly(Type.Optional(Type.Boolean())),
    force: Type.Readonly(Type.Optional(Type.Boolean())),
});

const RemoveConfigParser = Schema.Compile(RemoveConfigSchema);

const removeActionProvider: ActionProvider<typeof RemoveConfigSchema> = {
    kind: "remove",
    schema: RemoveConfigSchema,

    validate(config) {
        if (!RemoveConfigParser.Check(config)) {
            return {
                success: false,
                errors: ["Invalid remove action config"],
            };
        }

        return {
            success: true,
            value: RemoveConfigParser.Parse(config),
        };
    },

    async plan(input) {
        const recursive = input.action.config.recursive === true;
        const force = input.action.config.force === true;

        return {
            actionId: input.action.id,
            manifestId: input.action.manifestId,
            kind: input.action.uses,
            summary: `Remove ${input.action.config.path}`,
            safety: {
                idempotent: force,
                unsafe: true,
                reason: recursive
                    ? "recursive remove may delete many files"
                    : "remove deletes workstation state",
            },
            changes: [
                {
                    target: input.action.config.path,
                    operation: "delete",
                    before: undefined,
                    after: undefined,
                    message: recursive ? "remove recursively" : "remove path",
                },
            ],
        };
    },

    async apply(input) {
        return {
            actionId: input.action.id,
            success: false,
            message: "remove apply is not implemented yet",
        };
    },
};

export default createPlugin({
    id: "remove",
    actions: {
        remove: removeActionProvider,
    },
});
