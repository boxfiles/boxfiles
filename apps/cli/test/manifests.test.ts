import { describe, expect, test } from "bun:test";
import {
  renderManifestList,
  renderManifestPlan,
} from "../src/cmds/manifests";
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
