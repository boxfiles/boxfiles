import { describe, expect, test } from "bun:test";
import { ContextService } from "@boxfiles/core";
import { PluginRegistry } from "@boxfiles/plugin";
import userPlugin from "../src/index";

describe("user provider", () => {
    test("gathers user facts through the plugin context path", async () => {
        const registry = new PluginRegistry();
        const contextService = ContextService.create();

        registry.registerPlugin(userPlugin);
        const facts = await registry.gatherContextFacts(contextService);
        const keys = facts.map((fact) => fact.key.toString());
        const snapshot = contextService.snapshot();

        expect(keys).toContain("user.username");
        expect(snapshot["user.username"]).toBeTypeOf("string");
        expect(Object.values(snapshot)).not.toContain("unknown");
        expect(Object.values(snapshot)).not.toContain(null);
    });
});
