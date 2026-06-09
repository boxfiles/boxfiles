import Type from "typebox";
import Schema from "typebox/schema";
import { NonBlankStringSchema } from "@zenobius/boxfiles-core";
import {
    type ActionProvider,
    createPlugin,
} from "@zenobius/boxfiles-core";

const SymlinkConfigSchema = Type.Object({
    from: Type.Readonly(NonBlankStringSchema),
    to: Type.Readonly(NonBlankStringSchema),
});

const SymlinkConfigParser = Schema.Compile(SymlinkConfigSchema);

const symlinkActionProvider: ActionProvider<typeof SymlinkConfigSchema> = {
    kind: "symlink",
    schema: SymlinkConfigSchema,

    validate(config) {
        if (!SymlinkConfigParser.Check(config)) {
            return {
                success: false,
                errors: ["Invalid symlink action config"],
            };
        }

        return {
            success: true,
            value: SymlinkConfigParser.Parse(config),
        };
    },

    async plan(input) {
        return {
            actionId: input.action.id,
            manifestId: input.action.manifestId,
            kind: input.action.uses,
            summary: `Symlink ${input.action.config.from} to ${input.action.config.to}`,
            safety: {
                idempotent: true,
                unsafe: false,
                reason: undefined,
            },
            changes: [
                {
                    target: input.action.config.to,
                    operation: "create",
                    before: undefined,
                    after: {
                        source: input.action.config.from,
                    },
                    message: "create symbolic link",
                },
            ],
        };
    },

    async apply(input) {
        return {
            actionId: input.action.id,
            success: false,
            message: "symlink apply is not implemented yet",
        };
    },
};

export default createPlugin({
    id: "link",
    actions: {
        symlink: symlinkActionProvider,
    },
});
