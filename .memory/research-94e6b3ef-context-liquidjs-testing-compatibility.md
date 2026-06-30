## Thinking

Research unit: `.memory/research-94e6b3ef-context-liquidjs-testing-compatibility.md`.

Skills discovered before research:
- `e2e-testing-cli-with-bats`: relevant because Boxfiles already has shell e2e tests for CLI behavior, exit status, output, and isolated `HOME`/fixture state.
- `typescript-styleguide`: relevant because the affected implementation and unit tests are TypeScript, with strict repo constraints.
- `moonrepo-run-tasks`: relevant because verification should use existing `moon run <project>:<target>` selectors instead of broad ad hoc commands.
- `creating-cli-tools`: lightly relevant for CLI output/exit-code compatibility around `apply`, `manifests`, and `context facts`.

The smallest useful strategy is not a new test framework. This repo uses Bun test, Bats e2e, and Moon tasks; Vitest is not present.

## Research

### Current repo test shape

- Unit tests are Bun tests, not Vitest: test files import from `bun:test`, e.g. `apps/cli/test/ContextFacts.test.ts:2:c21`, `pkgs/core/test/Manifest.test.ts:1:3dd`, and the repo grep found no `vitest` references.
- CLI e2e is Bats-backed. `apps/cli/moon.yml:18:e33` defines `e2e`; it creates a temp dir and runs `TMPDIR="$tmp" bats ./e2e/*.bats.sh` at `apps/cli/moon.yml:19:e5e`-`apps/cli/moon.yml:23:920`.
- Library projects also expose the same Bats target pattern, e.g. `pkgs/core/moon.yml:33:e33`-`pkgs/core/moon.yml:38:920`, `pkgs/provider-copy/moon.yml:24:e33`-`pkgs/provider-copy/moon.yml:29:920`, and `pkgs/provider-run/moon.yml:24:e33`-`pkgs/provider-run/moon.yml:29:920`.
- Root Moon targets run affected subsets for lint/test/build/typecheck at `moon.yml:4:9f8`-`moon.yml:12:f8d`; full demo e2e builds a container and runs it at `moon.yml:17:7e1`-`moon.yml:34:606`.

### Current context/template flow

- Manifest compilation currently accepts context but ignores it: `ManifestService.compile` has `_context: ManifestCompileContext = { facts: {} }` at `pkgs/core/src/services/Manifest.ts:178:9bb`-`pkgs/core/src/services/Manifest.ts:180:4bc`; the comment says interpolation is intentionally not implemented at `pkgs/core/src/services/Manifest.ts:174:f0d`-`pkgs/core/src/services/Manifest.ts:176:8d7`.
- Planning receives gathered facts and passes them into providers as `ctx.facts`: `ManifestService.plan` passes `context.facts` into `PlanService` at `pkgs/core/src/services/Manifest.ts:193:f7b`-`pkgs/core/src/services/Manifest.ts:203:82c`; `PlanService.compile` passes `ctx.rootDir`, `ctx.facts`, and `ctx.manifest` to provider planning at `pkgs/core/src/services/Plan.ts:124:099`-`pkgs/core/src/services/Plan.ts:132:2f6`.
- Applying also passes facts to providers: `PlanExecutor.execute` uses `ctx: { rootDir, facts, manifest }` at `pkgs/core/src/services/Plan.ts:193:069`-`pkgs/core/src/services/Plan.ts:197:d86`.
- `when` is not template-aware today; it only treats trimmed `false`, `0`, and `off` as false at `pkgs/core/src/services/Plan.ts:219:989`-`pkgs/core/src/services/Plan.ts:223:b18`.
- Runtime gathers context before planning/applying. `apply` gathers `facts` then calls `runtime.manifestService.plan({ facts })` at `apps/cli/src/cmds/apply.ts:39:511`-`apps/cli/src/cmds/apply.ts:41:717`, and execution reuses those facts at `apps/cli/src/cmds/apply.ts:48:4a9`.
- Plugin context is flat key/value or resolver based. `ContextDefinition` is `key -> entry` at `pkgs/core/src/services/Context.ts:76:394`-`pkgs/core/src/services/Context.ts:78:eea`; `ContextService.snapshot()` returns a flat record at `pkgs/core/src/services/Context.ts:121:20c`-`pkgs/core/src/services/Context.ts:123:b18`.
- Plugin fact gathering resolves each entry with the current snapshot and stores non-`undefined` results at `pkgs/plugin/src/runtime.ts:327:631`-`pkgs/plugin/src/runtime.ts:341:f18`; this matters for backwards compatibility because computed facts may depend on earlier facts.
- Context CLI coverage already asserts JSON shape, prefix filtering, and empty prefix behavior in `apps/cli/test/ContextFacts.test.ts:18:e7a`-`apps/cli/test/ContextFacts.test.ts:63:d86`, with a local context plugin fixture at `apps/cli/test/ContextFacts.test.ts:143:416`-`apps/cli/test/ContextFacts.test.ts:157:de8`.
- Provider context coverage already checks OS resolver behavior and snapshot reuse at `pkgs/provider-os/test/facts.test.ts:96:80e`-`pkgs/provider-os/test/facts.test.ts:114:d86`, and plugin context path omission semantics at `pkgs/provider-os/test/provider.test.ts:25:19a`-`pkgs/provider-os/test/provider.test.ts:56:d86`.

### Existing e2e tests that would catch regressions nearby

- `apps/cli/e2e/apply.bats.sh` catches apply dry-run/live apply/failure/unsafe behavior; false `when` skip is asserted at `apps/cli/e2e/apply.bats.sh:63:0b5`-`apps/cli/e2e/apply.bats.sh:70:b18`.
- `pkgs/provider-run/e2e/run.bats.sh` also covers false `when` skip at `pkgs/provider-run/e2e/run.bats.sh:62:960`-`pkgs/provider-run/e2e/run.bats.sh:76:b18`.
- `pkgs/provider-copy/e2e/copy.bats.sh` catches provider config validation and application around copy sources/targets at `pkgs/provider-copy/e2e/copy.bats.sh:22:e46`-`pkgs/provider-copy/e2e/copy.bats.sh:56:b18`, plus bad source rejection at `pkgs/provider-copy/e2e/copy.bats.sh:58:ae7`-`pkgs/provider-copy/e2e/copy.bats.sh:71:b18`.
- `pkgs/core/e2e/manifests.bats.sh` catches manifest discovery, validation errors, and plan output at `pkgs/core/e2e/manifests.bats.sh:12:4d2`-`pkgs/core/e2e/manifests.bats.sh:51:b18`.
- Fixtures are isolated by `pkgs/e2e-common/helpers.sh`: demo fixture copies `apps/demo` and sets `HOME` at `pkgs/e2e-common/helpers.sh:6:45e`-`pkgs/e2e-common/helpers.sh:12:b18`; empty fixture does the same at `pkgs/e2e-common/helpers.sh:14:707`-`pkgs/e2e-common/helpers.sh:19:b18`.

### Manifest examples impacted by template/context access

- The demo root manifest is structural only (`steps: []`) at `apps/demo/boxfiles.yaml:1:c2d`-`apps/demo/boxfiles.yaml:3:dd9`.
- `apps/demo/workstation.yaml` has a `copy` action with `from` and `to` strings that are obvious candidates for interpolation regression tests at `apps/demo/workstation.yaml:3:ba5`-`apps/demo/workstation.yaml:7:c75`.
- The original design expected manifests to be template-language-like for interpolation of facts into conditions/dependencies/actions at `IDEA.md:21:d82`-`IDEA.md:23:795`, but implementation currently has not done it.

### LiquidJS behavior worth testing, not reimplementing

External sources, accessed 2026-06-29:
- LiquidJS render API supports `parseAndRender(template, scope)` / rendering templates with a scope object: https://liquidjs.com/tutorials/render-file.html and https://liquidjs.com/api/classes/Liquid.html#parseAndRender.
- LiquidJS has strict variable options, including `strictVariables`, which make undefined variables error instead of silently rendering empty output: https://liquidjs.com/tutorials/options.html#strictvariables.
- LiquidJS supports custom filters (`engine.registerFilter`) and custom tags (`engine.registerTag`): https://liquidjs.com/tutorials/register-filters-tags.html.
- Liquid/LiquidJS conditionals and truthiness differ from this repo’s current `when` helper; Liquid has `{% if %}` tags and expression operators documented at https://liquidjs.com/tutorials/tags.html#if and https://liquidjs.com/tutorials/operators.html.

For this migration, tests should assert Boxfiles contracts, not Liquid internals: context only exposed through Boxfiles-approved template functions, unknown/direct property access fails, and old non-template manifests stay unchanged.

## Verification

Recommended smallest runnable checks after implementation:

1. `moon run core:test`  
   Covers manifest compile/plan unit behavior. Add template regression tests in `pkgs/core/test/Manifest.test.ts` because that harness already uses in-memory manifests and registered providers.

2. `moon run cli:test`  
   Covers runtime context gathering and CLI context facts. Extend `apps/cli/test/Runtime.test.ts` or `ContextFacts.test.ts` only if the Liquid function surface depends on configured plugin facts.

3. `moon run cli:e2e` and, if provider interpolation affects provider behavior, `moon run provider-copy:e2e provider-run:e2e core:e2e`  
   Bats catches actual binary behavior, shell quoting, output, and filesystem side effects.

4. `moon run core:typecheck cli:typecheck`  
   Needed because repo TypeScript is strict and the migration changes cross-package types around context/template functions.

No tests were run for this research-only task.

## Insights

Smallest viable regression suite:

1. **Core unit: backwards compatibility pass-through**  
   In `pkgs/core/test/Manifest.test.ts`, plan a manifest with no Liquid syntax and assert the same compiled provider config as today. This guards existing demo-style manifests.

2. **Core unit: template functions resolve facts in action config**  
   Use the existing memfs harness and `copy` provider. Provide `facts` with at least one flat key such as `user.home` or `os.platform`; assert a templated `with.to`/`with.from` field resolves before provider validation/planning. This catches the main context interpolation path.

3. **Core unit: direct context/property access is rejected**  
   Add one negative test proving `{{ os.platform }}` or equivalent direct scope lookup fails when the new contract requires function access only. This is the compatibility boundary for “all access of context is via template functions.”

4. **Core unit: `when` rendering stays compatible and becomes context-aware**  
   Preserve existing `when: "false"` skip behavior, then add one templated `when` case that resolves from a context function to false/off. Existing skip tests only cover literal false (`apps/cli/e2e/apply.bats.sh:63:0b5` and `pkgs/provider-run/e2e/run.bats.sh:62:960`).

5. **CLI/Bats e2e: one real manifest applies with plugin context through template function**  
   In one Bats file, create a local plugin under the temp fixture that exposes a deterministic fact, write a manifest that uses the new Liquid function in a `run` or `copy` action, run `boxfiles apply --confirm`, and assert the filesystem side effect. This catches runtime loading + gather + Liquid + provider apply in one test.

6. **CLI/Bats e2e: unknown fact/function failure is loud and non-mutating**  
   One negative e2e should assert non-zero status, useful error text, and no target file. This protects backwards compatibility by failing safely at the CLI boundary.

Keep the suite small: most Liquid expression/filter matrix behavior belongs to LiquidJS, not Boxfiles. Add more cases only when Boxfiles adds custom filters/tags/functions with their own semantics.

## Summary

Use existing Bun tests + Bats e2e; do not add Vitest. Put most regression coverage in `pkgs/core/test/Manifest.test.ts`, then one happy-path and one failure-path CLI e2e. Backwards compatibility means non-template manifests and literal `when: false` keep working while direct context/property access is rejected in favor of approved Liquid template functions.
