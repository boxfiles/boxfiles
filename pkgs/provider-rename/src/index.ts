import * as fs from "node:fs/promises";
import * as path from "node:path";
import Type from "typebox";
import Schema from "typebox/schema";
import { NonBlankStringSchema, type ActionProvider } from "@boxfiles/core";
import { createPlugin } from "@boxfiles/plugin";

const RenameConfigSchema = Type.Object({
    from: Type.Readonly(NonBlankStringSchema),
    to: Type.Readonly(NonBlankStringSchema),
});

const RenameConfigParser = Schema.Compile(RenameConfigSchema);

const renameActionProvider: ActionProvider<typeof RenameConfigSchema> = {
    kind: "rename",
    schema: RenameConfigSchema,

    validate(config) {
        if (!RenameConfigParser.Check(config)) {
            return {
                success: false,
                errors: ["Invalid rename action config"],
            };
        }

        return {
            success: true,
            value: RenameConfigParser.Parse(config),
        };
    },

    async plan(input) {
        return {
            actionId: input.action.id,
            manifestId: input.action.manifestId,
            kind: input.action.uses,
            summary: `Rename ${input.action.config.from} to ${input.action.config.to}`,
            safety: {
                idempotent: false,
                unsafe: true,
                reason: "rename moves workstation paths",
            },
            changes: [
                {
                    target: input.action.config.to,
                    operation: "update",
                    before: {
                        source: input.action.config.from,
                    },
                    after: {
                        target: input.action.config.to,
                    },
                    message: "rename workstation path",
                },
            ],
        };
    },

    async apply(input) {
        const sourcePath = expandHome(input.action.config.from);
        const targetPath = expandHome(input.action.config.to);

        if (await exists(targetPath)) {
            return {
                actionId: input.action.id,
                success: false,
                message: "target exists",
            };
        }

        await fs.rename(sourcePath, targetPath);

        return {
            actionId: input.action.id,
            success: true,
            message: "renamed",
        };
    },
};

function expandHome(targetPath: string): string {
    const home = process.env["HOME"];
    if (targetPath === "~") return home ?? targetPath;
    if (targetPath.startsWith("~/")) return path.join(home ?? "~", targetPath.slice(2));
    return targetPath;
}

async function exists(targetPath: string): Promise<boolean> {
    try {
        await fs.lstat(targetPath);
        return true;
    } catch {
        return false;
    }
}

export default createPlugin({
    id: "rename",
    actions: {
        rename: renameActionProvider,
    },
});
