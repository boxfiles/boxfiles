import { describe, expect, test } from "bun:test";
import {
  BoxfilesRcConfigDTO,
  BoxfilesRcValidationError,
  normalizeBoxfilesRcConfig,
  type BoxfilesRcFileDto,
} from "../src/index";

describe("BoxfilesRcConfigDTO", () => {
  test("normalizes string shorthand plugin declarations into typed records", () => {
    const parsed = BoxfilesRcConfigDTO.parse({
      plugins: {
        copy: "npm:@boxfiles/provider-copy@1.0.0",
        workstation: "git:https://example.com/boxfiles/workstation.git#v1",
        local: "file:./plugins/local",
      },
      facts: {
        profile: "workstation",
      },
    });

    expect(parsed.plugins).toEqual([
      { name: "copy", source: "npm:@boxfiles/provider-copy@1.0.0" },
      { name: "workstation", source: "git:https://example.com/boxfiles/workstation.git#v1" },
      { name: "local", source: "file:./plugins/local" },
    ]);
    expect(parsed.facts).toEqual({ profile: "workstation" });
  });

  test("defaults omitted plugin declarations to an empty normalized list", () => {
    const parsed = BoxfilesRcConfigDTO.parse({ settings: { facts: { collision: "keep-first" } } });

    expect(parsed.plugins).toEqual([]);
    expect(parsed.settings?.facts?.collision).toBe("keep-first");
  });

  test("normalizes an already validated file dto without reparsing", () => {
    const fileDto: BoxfilesRcFileDto = {
      plugins: {
        run: "npm:@boxfiles/provider-run@2.0.0",
      },
    };

    expect(normalizeBoxfilesRcConfig(fileDto).plugins).toEqual([
      { name: "run", source: "npm:@boxfiles/provider-run@2.0.0" },
    ]);
  });

  test("rejects non-map plugin declarations", () => {
    expectInvalidPluginDeclaration({ plugins: ["npm:@boxfiles/provider-copy"] });
  });

  test("rejects blank plugin names", () => {
    expectInvalidPluginDeclaration({ plugins: { " ": "npm:@boxfiles/provider-copy" } });
  });

  test("rejects blank plugin sources", () => {
    expectInvalidPluginDeclaration({ plugins: { copy: "" } });
  });

  test("rejects unsupported plugin source prefixes", () => {
    expectInvalidPluginDeclaration({ plugins: { copy: "github:boxfiles/provider-copy" } });
  });

  test("rejects plugin source prefixes without a source value", () => {
    expectInvalidPluginDeclaration({ plugins: { copy: "npm:" } });
  });
});

function expectInvalidPluginDeclaration(value: unknown): void {
  try {
    BoxfilesRcConfigDTO.parse(value);
  } catch (error) {
    expect(error).toBeInstanceOf(BoxfilesRcValidationError);
    if (!(error instanceof BoxfilesRcValidationError)) throw error;
    expect(error.message).toContain(".boxfilesrc");
    expect(error.errors.length).toBeGreaterThan(0);
    return;
  }

  throw new Error("Expected invalid .boxfilesrc plugin declaration to fail validation");
}
