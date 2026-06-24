import * as fs from "node:fs/promises";
import * as path from "node:path";
import Type from "typebox";
import Schema from "typebox/schema";
import { NonBlankStringSchema } from "@boxfiles/core";
import { type ActionProvider } from "@boxfiles/core";
import { createPlugin } from "@boxfiles/plugin";

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
        const sourcePath = path.join(
            input.ctx.rootDir,
            input.ctx.manifest.filesDir,
            input.action.config.from,
        );
        const targetPath = expandHome(input.action.config.to);

        if (await exists(targetPath)) {
            return {
                actionId: input.action.id,
                success: true,
                message: "target exists",
            };
        }

        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.symlink(sourcePath, targetPath);

        return {
            actionId: input.action.id,
            success: true,
            message: "linked",
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
    id: "link",
    actions: {
        symlink: symlinkActionProvider,
    },
});
