import { describe, expect, test } from "bun:test";
import {
  renderManifestList,
  renderManifestPlan,
  renderManifestPlanOutput,
} from "../src/cmds/manifests";
import { pluginReproducibilityWarning } from "@boxfiles/core";
import type {
  ActionKind,
  CompiledManifestDto,
  ExecutionPlanDto,
  ManifestContextDto,
  ManifestId,
  StepId,
} from "@boxfiles/core";

describe("renderManifestList", () => {
  test("renders flat manifest entries", () => {
    const items = [
      {
        manifest: createManifestContext("base.foundation", "base/foundation.toml"),
      },
      {
        manifest: createManifestContext(
          "development.source-control",
          "development/source-control.toml",
        ),
      },
    ] as const;

    expect(renderManifestList(items, (item) => `[${item.manifest.id}](${item.manifest.path})`)).toBe(
      [
        "- [base.foundation](base/foundation.toml)",
        "- [development.source-control](development/source-control.toml)",
      ].join("\n"),
    );
  });
});

describe("renderManifestPlan", () => {
  test("renders nested manifest plan entries", () => {
    const plan: ExecutionPlanDto = {
      manifests: [
        createCompiledManifest("base.foundation", "base/foundation.toml", [], 1),
        createCompiledManifest(
          "development.source-control",
          "development/source-control.toml",
          ["base.foundation"],
          1,
        ),
      ],
      actions: [],
    };

    expect(renderManifestPlan(plan)).toBe(
      [
        "## Manifest Plan",
        "",
        "- base.foundation (base/foundation.toml) 👣 1 👥 1",
        "  - development.source-control (development/source-control.toml) 👣 1",
      ].join("\n"),
    );
  });
});

describe("renderManifestPlanOutput", () => {
  test("omits plugin warning section when no warnings exist", () => {
    const plan: ExecutionPlanDto = {
      manifests: [createCompiledManifest("base.foundation", "base/foundation.toml", [], 1)],
      actions: [],
    };

    expect(renderManifestPlanOutput(plan, [])).toBe(renderManifestPlan(plan));
  });

  test("renders plugin reproducibility warnings after successful plan output", () => {
    const plan: ExecutionPlanDto = {
      manifests: [createCompiledManifest("base.foundation", "base/foundation.toml", [], 1)],
      actions: [],
    };
    const warnings = [
      pluginReproducibilityWarning("npm-demo", "npm:@boxfiles/plugin-demo"),
      pluginReproducibilityWarning("git-demo", "git:https://example.com/org/plugin.git"),
      pluginReproducibilityWarning("file-demo", "file:./plugins/local"),
    ] as const;

    const output = renderManifestPlanOutput(plan, warnings);

    expect(output).toContain("## Manifest Plan");
    expect(output).toContain("- base.foundation (base/foundation.toml) 👣 1");
    expect(output).toContain("## Plugin Reproducibility Warnings");
    expect(output).toContain("`npm-demo` (npm): npm source has no version spec");
    expect(output).toContain("planning uses the cached artifact, not live npm");
    expect(output).toContain("`git-demo` (git): git source has no ref");
    expect(output).toContain("planning uses the cached artifact, not live git");
    expect(output).toContain("`file-demo` (file): file source is local machine state");
    expect(output).toContain("planning uses the local path directly");
  });
});

function createManifestContext(id: string, path: string): ManifestContextDto {
  return {
    id: id as ManifestId,
    path,
    dir: path.split("/").slice(0, -1).join("/") || ".",
    filesDir: `${path.split("/").slice(0, -1).join("/") || "."}/files`,
  };
}

function createCompiledManifest(
  id: string,
  manifestPath: string,
  dependsOn: readonly string[],
  stepCount: number,
): CompiledManifestDto {
  return {
    id: id as ManifestId,
    path: manifestPath,
    manifest: createManifestContext(id, manifestPath),
    dependsOn: dependsOn.map((dependencyId) => dependencyId as ManifestId),
    steps: Array.from({ length: stepCount }, (_, index) => ({
      id: `${id}.${index + 1}` as StepId,
      manifestId: id as ManifestId,
      uses: "copy" as ActionKind,
      config: {},
    })),
  };
}
