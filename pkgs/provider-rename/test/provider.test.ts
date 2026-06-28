import { describe, expect, test } from "bun:test";
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
});
