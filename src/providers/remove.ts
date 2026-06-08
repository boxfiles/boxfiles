import Type from "typebox";
import Schema from "typebox/schema";
import { NonBlankStringSchema } from "../common/schema";
import {
    type ActionProvider,
    createPlugin,
} from "../services/Plugins";

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

    async plan({ action }) {
        const recursive = action.config.recursive === true;
        const force = action.config.force === true;

        return {
            actionId: action.id,
            manifestId: action.manifestId,
            kind: action.uses,
            summary: `Remove ${action.config.path}`,
            safety: {
                idempotent: force,
                unsafe: true,
                requiresConfirmation: !force || recursive,
                reason: recursive
                    ? "recursive remove may delete many files"
                    : "remove deletes workstation state",
            },
            changes: [
                {
                    target: action.config.path,
                    operation: "delete",
                    before: undefined,
                    after: undefined,
                    message: recursive ? "remove recursively" : "remove path",
                },
            ],
        };
    },

    async apply({ action }) {
        return {
            actionId: action.id,
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
