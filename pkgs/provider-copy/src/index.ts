import Type from "typebox";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import Schema from "typebox/schema";
import { NonBlankStringSchema } from "@boxfiles/core";
import { type ActionProvider } from "@boxfiles/core";
import { createPlugin } from "@boxfiles/plugin";

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
        const sourcePath = path.join(
            input.ctx.rootDir,
            input.ctx.manifest.filesDir,
            input.action.config.from,
        );
        const targetPath = expandHome(input.action.config.to);

        if (!input.action.config.overwrite && await exists(targetPath)) {
            return {
                actionId: input.action.id,
                success: true,
                message: "target exists",
            };
        }

        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.cp(sourcePath, targetPath, {
            recursive: true,
            force: input.action.config.overwrite === true,
            errorOnExist: input.action.config.overwrite !== true,
        });

        return {
            actionId: input.action.id,
            success: true,
            message: "copied",
        };
    },
};

function hasInvalidSourcePrefix(from: string): boolean {
    const normalized = from.replaceAll("\\", "/").replace(/^\.\//, "");
    if (path.isAbsolute(from)) return true;
    if (normalized === "files" || normalized.startsWith("files/")) return true;
    return normalized === ".." || normalized.startsWith("../");
}

function expandHome(targetPath: string): string {
    const home = process.env["HOME"];
    if (targetPath === "~") return home ?? targetPath;
    if (targetPath.startsWith("~/")) return path.join(home ?? "~", targetPath.slice(2));
    return targetPath;
}

async function exists(targetPath: string): Promise<boolean> {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}


export default createPlugin({
    id: "copy",
    actions: {
        copy: copyActionProvider,
    },
});
