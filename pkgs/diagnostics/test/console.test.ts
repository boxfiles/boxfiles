import { describe, expect, test } from "bun:test";
import { formatPluginReproducibilityWarnings, prettyPrintTypeboxErrors } from "../src";

describe("prettyPrintTypeboxErrors", () => {
  test("formats validation details", () => {
    const output = prettyPrintTypeboxErrors({
      manifestPath: "manifests/demo.toml",
      errors: [
        {
          instancePath: "/steps/0/uses",
          keyword: "string",
          schemaPath: "#/properties/uses",
          params: { type: "string" },
        } as never,
      ],
    });

    expect(output).toContain("## Validation Errors");
    expect(output).toContain("manifest path: `manifests/demo.toml`");
    expect(output).toContain("**string** at `/steps/0/uses`");
  });
});

describe("formatPluginReproducibilityWarnings", () => {
  test("formats warnings", () => {
    const output = formatPluginReproducibilityWarnings([
      { kind: "npm", name: "demo", source: "npm:demo", message: "npm source has no version spec" },
    ]);

    expect(output).toContain("## Plugin Reproducibility Warnings");
    expect(output).toContain("`demo` (npm): npm source has no version spec");
  });
});
