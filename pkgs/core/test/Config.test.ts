import { describe, expect, test } from "bun:test";
import {
  BoxfilesRcConfigDTO,
  BoxfilesRcValidationError,
  normalizeBoxfilesRcConfig,
  type BoxfilesRcFileDto,
} from "../src/index";

const CONFIG_FIXTURE_ROOT = `${import.meta.dir}/fixtures/config-parser`;

const INVALID_PLUGIN_FIXTURE_PATHS = [
  "invalid/missing-id-empty/.boxfilesrc",
  "invalid/missing-id-whitespace/.boxfilesrc",
  "invalid/invalid-source-prefix-github/.boxfilesrc",
  "invalid/invalid-source-prefix-https/.boxfilesrc",
  "invalid/malformed-source-number/.boxfilesrc",
  "invalid/malformed-source-object/.boxfilesrc",
  "invalid/malformed-source-whitespace/.boxfilesrc",
] as const;
describe("BoxfilesRcConfigDTO", () => {
  test("parses valid .boxfilesrc fixture with npm git and file plugins", async () => {
    const parsed = BoxfilesRcConfigDTO.parse(await readConfigFixture("valid/.boxfilesrc"));

    expect(parsed.plugins).toEqual([
      { name: "copy", source: "npm:@boxfiles/provider-copy@1.0.0" },
      { name: "workstation", source: "git:https://example.com/boxfiles/workstation.git#v1" },
      { name: "local", source: "file:./plugins/local" },
    ]);
    expect(parsed.settings?.facts?.collision).toBe("keep-first");
    expect(parsed.settings?.plugins?.allowRemote).toBe(true);
    expect(parsed.facts).toEqual({ profile: "workstation" });
  });

  for (const fixturePath of INVALID_PLUGIN_FIXTURE_PATHS) {
    test(`rejects invalid .boxfilesrc plugin fixture ${fixturePath}`, async () => {
      expectInvalidPluginDeclaration(await readConfigFixture(fixturePath));
    });
  }

  test("documents duplicate plugin ids are not representable after JSON fixture parsing", async () => {
    const parsed = BoxfilesRcConfigDTO.parse(await readConfigFixture("duplicates/.boxfilesrc"));

    // The DTO boundary receives a JSON object map; duplicate keys are collapsed by JSON.parse
    // before schema validation can see them. Deterministic failure is therefore impossible here.
    expect(parsed.plugins).toEqual([{ name: "copy", source: "file:./plugins/copy" }]);
  });
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

async function readConfigFixture(relativePath: string): Promise<unknown> {
  return JSON.parse(await Bun.file(`${CONFIG_FIXTURE_ROOT}/${relativePath}`).text()) as unknown;
}

function expectInvalidPluginDeclaration(value: unknown): void {
  expect(() => BoxfilesRcConfigDTO.parse(value)).toThrow(BoxfilesRcValidationError);

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
