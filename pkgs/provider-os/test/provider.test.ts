import { describe, expect, test } from "bun:test";
import { ContextService } from "@boxfiles/core";
import { createPlugin, PluginRegistry } from "@boxfiles/plugin";
import { createOsContext, type OsApi } from "../src/facts";
import osPlugin from "../src/index";

describe("os provider", () => {
    test("gathers baseline facts through the plugin context path", async () => {
        const registry = new PluginRegistry();
        const contextService = ContextService.create();

        registry.registerPlugin(osPlugin);
        const facts = await registry.gatherContextFacts(contextService);
        const keys = facts.map((fact) => fact.key.toString());
        const snapshot = contextService.snapshot();

        expect(keys).toContain("os.platform");
        expect(keys).toContain("os.arch");
        expect(snapshot["os.platform"]).toBeTypeOf("string");
        expect(snapshot["os.arch"]).toBeTypeOf("string");
        expect(Object.values(snapshot)).not.toContain("unknown");
        expect(Object.values(snapshot)).not.toContain(null);
    });

    test("omits unavailable facts through the plugin context path", async () => {
        const os: OsApi = {
            platform: () => "linux",
            type: () => "Linux",
            release: () => "6.1.0",
            version: () => "#1 SMP",
            arch: () => "x64",
            machine: () => "",
            hostname: () => "forge",
            tmpdir: () => "/tmp",
            totalmem: () => 1024,
            freemem: () => 512,
        };
        const registry = new PluginRegistry();
        const contextService = ContextService.create();

        registry.registerPlugin(createPlugin({
            id: "os-test",
            context: createOsContext({
                os,
                readFile: async () => {
                    throw new Error("missing os-release");
                },
            }),
        }));
        await registry.gatherContextFacts(contextService);
        const snapshot = contextService.snapshot();

        expect("os.machine" in snapshot).toBe(false);
        expect("os.homedir" in snapshot).toBe(false);
        expect("os.distro.id" in snapshot).toBe(false);
    });
});
