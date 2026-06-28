import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { type ActionKind, type ManifestId, type StepId } from "@boxfiles/core";
import renamePlugin from "../src/index";

const renameAction = renamePlugin.actions?.rename;

describe("rename provider", () => {
    test("rejects relative source paths", () => {
        expect(renameAction).toBeDefined();

        const result = renameAction!.validate({
            from: "relative/source.txt",
            to: "/tmp/target.txt",
        });

        expect(result.success).toBe(false);
    });


    test("rejects relative target paths", () => {
        expect(renameAction).toBeDefined();

        const result = renameAction!.validate({
            from: "/tmp/source.txt",
            to: "relative/target.txt",
        });

        expect(result.success).toBe(false);
    });

    test("rejects same source and target paths after normalization", () => {
        expect(renameAction).toBeDefined();

        const result = renameAction!.validate({
            from: "/tmp/boxfiles/source/../target.txt",
            to: "/tmp/boxfiles/target.txt",
        });

        expect(result.success).toBe(false);
    });


    test("accepts absolute paths without requiring them to exist", () => {
        expect(renameAction).toBeDefined();

        const result = renameAction!.validate({
            from: "/tmp/boxfiles/source-does-not-exist.txt",
            to: "/tmp/boxfiles/target-does-not-exist.txt",
        });

        expect(result.success).toBe(true);
    });

    test("plans an unsafe non-idempotent destination update", async () => {
        expect(renameAction).toBeDefined();

        const plan = await renameAction!.plan({
            action: {
                id: "rename-test.0" as StepId,
                manifestId: "rename-test" as ManifestId,
                uses: "rename" as ActionKind,
                config: {
                    from: "/tmp/boxfiles/source.txt",
                    to: "/tmp/boxfiles/target.txt",
                },
            },
            plan: null,
            ctx: {
                rootDir: "/tmp/boxfiles",
                facts: {},
                manifest: {
                    id: "rename-test" as ManifestId,
                    path: "rename.yaml",
                    dir: ".",
                    filesDir: "files",
                },
            },
        });

        expect(plan.safety).toEqual({
            idempotent: false,
            unsafe: true,
            reason: "rename moves workstation paths",
        });
        expect(plan.changes).toEqual([
            {
                target: "/tmp/boxfiles/target.txt",
                operation: "update",
                before: { source: "/tmp/boxfiles/source.txt" },
                after: { target: "/tmp/boxfiles/target.txt" },
                message: "rename workstation path",
            },
        ]);
    });


    test("apply fails when source is missing", async () => {
        const paths = await createRenamePaths();

        const result = await renameAction!.apply(createApplyInput(paths.source, paths.target));

        expect(result).toEqual({
            actionId: "rename-test.0",
            success: false,
            message: `source does not exist: ${paths.source}`,
        });
        expect(await pathExists(paths.target)).toBe(false);

        await cleanup(paths.root);
    });

    test("apply creates missing target parent directories", async () => {
        const paths = await createRenamePaths();
        await writeFile(paths.source, "renamed\n");

        const result = await renameAction!.apply(createApplyInput(paths.source, paths.target));

        expect(result).toEqual({
            actionId: "rename-test.0",
            success: true,
            message: `renamed ${paths.source} to ${paths.target}`,
        });
        expect(await pathExists(paths.source)).toBe(false);
        expect(await readFile(paths.target, "utf8")).toBe("renamed\n");

        await cleanup(paths.root);
    });

    test("apply fails when target exists without overwrite", async () => {
        const paths = await createRenamePaths();
        await mkdir(join(paths.root, "target"), { recursive: true });
        await writeFile(paths.source, "source\n");
        await writeFile(paths.target, "target\n");

        const result = await renameAction!.apply(createApplyInput(paths.source, paths.target));

        expect(result).toEqual({
            actionId: "rename-test.0",
            success: false,
            message: `target exists: ${paths.target}`,
        });
        expect(await readFile(paths.source, "utf8")).toBe("source\n");
        expect(await readFile(paths.target, "utf8")).toBe("target\n");

        await cleanup(paths.root);
    });

    test("apply removes existing file target with overwrite", async () => {
        const paths = await createRenamePaths();
        await mkdir(join(paths.root, "target"), { recursive: true });
        await writeFile(paths.source, "source\n");
        await writeFile(paths.target, "target\n");

        const result = await renameAction!.apply(createApplyInput(paths.source, paths.target, true));

        expect(result).toEqual({
            actionId: "rename-test.0",
            success: true,
            message: `renamed ${paths.source} to ${paths.target}`,
        });
        expect(await pathExists(paths.source)).toBe(false);
        expect(await readFile(paths.target, "utf8")).toBe("source\n");

        await cleanup(paths.root);
    });

    test("apply removes existing directory target with overwrite", async () => {
        const paths = await createRenamePaths();
        await mkdir(paths.source, { recursive: true });
        await writeFile(join(paths.source, "source.txt"), "source\n");
        await mkdir(paths.target, { recursive: true });
        await writeFile(join(paths.target, "target.txt"), "target\n");

        const result = await renameAction!.apply(createApplyInput(paths.source, paths.target, true));

        expect(result).toEqual({
            actionId: "rename-test.0",
            success: true,
            message: `renamed ${paths.source} to ${paths.target}`,
        });
        expect(await pathExists(paths.source)).toBe(false);
        expect(await pathExists(join(paths.target, "target.txt"))).toBe(false);
        expect(await readFile(join(paths.target, "source.txt"), "utf8")).toBe("source\n");

        await cleanup(paths.root);
    });
});


type RenamePaths = {
    readonly root: string;
    readonly source: string;
    readonly target: string;
};

async function createRenamePaths(): Promise<RenamePaths> {
    const root = await mkdtemp(join(tmpdir(), "boxfiles-rename-"));

    return {
        root,
        source: join(root, "source.txt"),
        target: join(root, "target", "target.txt"),
    };
}

function createApplyInput(source: string, target: string, overwrite = false) {
    return {
        action: {
            id: "rename-test.0" as StepId,
            manifestId: "rename-test" as ManifestId,
            uses: "rename" as ActionKind,
            config: {
                from: source,
                to: target,
                overwrite,
            },
        },
        plan: {
            actionId: "rename-test.0" as StepId,
            manifestId: "rename-test" as ManifestId,
            kind: "rename" as ActionKind,
            summary: "rename test",
            safety: {
                idempotent: false,
                unsafe: true,
                reason: "rename moves workstation paths",
            },
            changes: [],
        },
        ctx: {
            rootDir: "/tmp/boxfiles",
            facts: {},
            manifest: {
                id: "rename-test" as ManifestId,
                path: "rename.yaml",
                dir: ".",
                filesDir: "files",
            },
        },
    };
}

async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await readFile(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function cleanup(root: string): Promise<void> {
    await rm(root, { recursive: true, force: true });
}
