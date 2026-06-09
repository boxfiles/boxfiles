import Type from "typebox";
import Schema from "typebox/schema";
import { NonBlankStringSchema } from "@boxfiles/core";
import {
    type ActionProvider,
    createPlugin,
} from "@boxfiles/core";

const RunConfigSchema = Type.Object({
    command: Type.Readonly(NonBlankStringSchema),
});

const RunConfigParser = Schema.Compile(RunConfigSchema);

const runActionProvider: ActionProvider<typeof RunConfigSchema> = {
    kind: "run",
    schema: RunConfigSchema,

    validate(config) {
        if (!RunConfigParser.Check(config)) {
            return {
                success: false,
                errors: ["Invalid run action config"],
            };
        }

        return {
            success: true,
            value: RunConfigParser.Parse(config),
        };
    },

    async plan(input) {
        return {
            actionId: input.action.id,
            manifestId: input.action.manifestId,
            kind: input.action.uses,
            summary: `Run ${input.action.config.command}`,
            safety: {
                idempotent: false,
                unsafe: true,
                reason: "arbitrary command execution may mutate workstation state",
            },
            changes: [
                {
                    target: input.ctx.rootDir,
                    operation: "execute",
                    before: undefined,
                    after: {
                        command: input.action.config.command,
                    },
                    message: "run shell command",
                },
            ],
        };
    },

    async apply(input) {
        return {
            actionId: input.action.id,
            success: false,
            message: "run apply is not implemented yet",
        };
    },
};

export default createPlugin({
    id: "run",
    actions: {
        run: runActionProvider,
    },
});
