import { describe, expect, test } from "bun:test";
import { parsePluginSource, PluginSourceParseError } from "../src/index";

describe("parsePluginSource", () => {
  test("parses npm scoped packages with versions", () => {
    expect(parsePluginSource("npm:@boxfiles/provider-copy@1.2.3")).toEqual({
      kind: "npm",
      packageName: "@boxfiles/provider-copy",
      version: "1.2.3",
    });
  });

  test("parses npm unscoped packages without versions", () => {
    expect(parsePluginSource("npm:boxfiles-provider-copy")).toEqual({
      kind: "npm",
      packageName: "boxfiles-provider-copy",
    });
  });

  test("parses git URLs and refs", () => {
    expect(parsePluginSource("git:https://example.com/boxfiles/workstation.git#v1.0.0")).toEqual({
      kind: "git",
      url: "https://example.com/boxfiles/workstation.git",
      ref: "v1.0.0",
    });
  });

  test("parses scp-like git URLs", () => {
    expect(parsePluginSource("git:git@github.com:boxfiles/provider-copy.git#main")).toEqual({
      kind: "git",
      url: "git@github.com:boxfiles/provider-copy.git",
      ref: "main",
    });
  });

  test("parses file paths without touching the filesystem", () => {
    expect(parsePluginSource("file:./plugins/local")).toEqual({
      kind: "file",
      path: "./plugins/local",
    });
    expect(parsePluginSource("file:/opt/boxfiles/plugins/local")).toEqual({
      kind: "file",
      path: "/opt/boxfiles/plugins/local",
    });
  });

  test("rejects unsupported protocols and shorthands", () => {
    expectInvalidSource("github:boxfiles/provider-copy");
    expectInvalidSource("https://example.com/boxfiles/provider-copy.git");
    expectInvalidSource("git:ftp://example.com/boxfiles/provider-copy.git");
    expectInvalidSource("file:https://example.com/plugin");
    expectInvalidSource("git:https:example.com/boxfiles/provider-copy.git");
    expectInvalidSource("git:https://example.com");
  });

  test("rejects malformed git refs", () => {
    expectInvalidSource("git:https://example.com/boxfiles/workstation.git#");
    expectInvalidSource("git:https://example.com/boxfiles/workstation.git#feature..name");
    expectInvalidSource("git:https://example.com/boxfiles/workstation.git#feature lock");
    expectInvalidSource("git:https://example.com/boxfiles/workstation.git#refs/heads/main.lock");
    expectInvalidSource("git:https://example.com/boxfiles/workstation.git#refs//heads/main");
    expectInvalidSource("git:https://example.com/boxfiles/workstation.git#@");
    expectInvalidSource("git:https://example.com/boxfiles/workstation.git#feature\u0001name");
  });

  test("rejects ambiguous or malformed npm specs", () => {
    expectInvalidSource("npm:@boxfiles/provider-copy@");
    expectInvalidSource("npm:@boxfiles");
    expectInvalidSource("npm:https://registry.example.com/provider-copy");
    expectInvalidSource("npm:BoxFilesProvider");
  });
});

function expectInvalidSource(source: string): void {
  expect(() => parsePluginSource(source)).toThrow(PluginSourceParseError);
}
