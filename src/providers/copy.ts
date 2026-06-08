import Type from "typebox";
import Schema from "typebox/schema";
import { NonBlankStringSchema } from "../common/schema";
import {
    type ActionProvider,
    createPlugin,
} from "../services/Plugins";

const CopyConfigSchema = Type.Object({
    from: Type.Readonly(NonBlankStringSchema),
    to: Type.Readonly(NonBlankStringSchema),
    overwrite: Type.Readonly(Type.Optional(Type.Boolean())),
});

const CopyConfigParser = Schema.Compile(CopyConfigSchema);

const copyActionProvider: ActionProvider<typeof CopyConfigSchema> = {
    kind: "copy",
    schema: CopyConfigSchema,

    validate(config) {
        if (!CopyConfigParser.Check(config)) {
            return {
                success: false,
                errors: ["Invalid copy action config"],
            };
        }

        return {
            success: true,
            value: CopyConfigParser.Parse(config),
        };
    },

    async plan({ action }) {
        return {
            actionId: action.id,
            manifestId: action.manifestId,
            kind: action.uses,
            summary: `Copy ${action.config.from} to ${action.config.to}`,
            safety: {
                idempotent: true,
                unsafe: action.config.overwrite === true,
                requiresConfirmation: action.config.overwrite === true,
                reason: action.config.overwrite === true
                    ? "copy may overwrite existing target"
                    : undefined,
            },
            changes: [
                {
                    target: action.config.to,
                    operation: action.config.overwrite === true ? "update" : "create",
                    before: undefined,
                    after: {
                        source: action.config.from,
                    },
                    message: "copy file or directory",
                },
            ],
        };
    },

    async apply({ action }) {
        return {
            actionId: action.id,
            success: false,
            message: "copy apply is not implemented yet",
        };
    },
};

export default createPlugin({
    id: "copy",
    actions: {
        copy: copyActionProvider,
    },
});
