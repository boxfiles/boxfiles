import { describe, expect, test } from "bun:test";
import { formatPluginReproducibilityWarnings, pluginReproducibilityWarning } from "@boxfiles/diagnostics";

describe("pluginReproducibilityWarning", () => {
  test("marks npm, git, and file sources as non-reproducible without blocking", () => {
    const npmWarning = pluginReproducibilityWarning("registry", "npm:@boxfiles/plugin-demo");
    const gitWarning = pluginReproducibilityWarning("remote", "git:https://example.com/org/plugin.git");
    const fileWarning = pluginReproducibilityWarning("local", "file:./plugins/local");

    expect(npmWarning.kind).toBe("npm");
    expect(npmWarning.message).toContain("floating and unlocked");
    expect(npmWarning.message).toContain("planning uses the cached artifact");
    expect(gitWarning.kind).toBe("git");
    expect(gitWarning.message).toContain("remote default branch");
    expect(gitWarning.message).toContain("planning uses the cached artifact");
    expect(fileWarning.kind).toBe("file");
    expect(fileWarning.message).toContain("local machine state");
  });

  test("formats warnings for CLI markdown output", () => {
    const warning = pluginReproducibilityWarning("demo", "npm:plugin-demo@1.0.0");
    const output = formatPluginReproducibilityWarnings([warning]);

    expect(output).toContain("## Plugin Reproducibility Warnings");
    expect(output).toContain("`demo` (npm)");
    expect(output).toContain("not integrity-locked");
  });
});
