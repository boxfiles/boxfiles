import Type from "typebox";
import * as path from "node:path";
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

        const parsed = CopyConfigParser.Parse(config);
        if (hasInvalidSourcePrefix(parsed.from)) {
            return {
                success: false,
                errors: [
                    "copy.from is relative to the manifest files directory; omit files/ prefix and parent traversal",
                ],
            };
        }

        return {
            success: true,
            value: parsed,
        };
    },

    async plan(input) {
        const sourcePath = path.join(
            input.ctx.rootDir,
            input.ctx.manifest.filesDir,
            input.action.config.from,
        );

        return {
            actionId: input.action.id,
            manifestId: input.action.manifestId,
            kind: input.action.uses,
            summary: `Copy ${input.action.config.from} from manifest files to ${input.action.config.to}`,
            safety: {
                idempotent: true,
                unsafe: input.action.config.overwrite === true,
                reason: input.action.config.overwrite === true
                    ? "copy may overwrite existing target"
                    : undefined,
            },
            changes: [
                {
                    target: input.action.config.to,
                    operation: input.action.config.overwrite === true ? "update" : "create",
                    before: undefined,
                    after: {
                        source: sourcePath,
                    },
                    message: "copy file or directory from manifest files",
                },
            ],
        };
    },

    async apply(input) {
        return {
            actionId: input.action.id,
            success: false,
            message: "copy apply is not implemented yet",
        };
    },
};

function hasInvalidSourcePrefix(from: string): boolean {
    const normalized = from.replaceAll("\\", "/").replace(/^\.\//, "");
    if (path.isAbsolute(from)) return true;
    if (normalized === "files" || normalized.startsWith("files/")) return true;
    return normalized === ".." || normalized.startsWith("../");
}


export default createPlugin({
    id: "copy",
    actions: {
        copy: copyActionProvider,
    },
});
