---
description: Add or improve CLI E2E coverage with Bats in this monorepo
argument-hint: "<target command/provider/behavior>"
---

Task: create or improve Boxfiles CLI E2E coverage for:

`$ARGUMENTS`

## Required skills

Load and apply these skills before changing files:

- `.agents/skills/e2e-testing-cli-with-bats/SKILL.md`
- `.agents/skills/creating-cli-tools/SKILL.md`
- `.agents/skills/typescript/SKILL.md`
- `codemapper`
- `run-tasks`
- `adding-new-tasks`

Load `.agents/skills/with-bun/SKILL.md` only when task/toolchain/runtime behavior matters. Do not load broad expert/test-strategy skills unless this request becomes a repo-wide test strategy task.

## Repo rules to enforce

Read `AGENTS.md` first. Follow its E2E rules exactly:

- Real CLI smoke tests MUST be Bats tests named `*.bats.sh` under the owning project `e2e/` directory.
- Shared helpers MUST live in `pkgs/e2e-common/helpers.sh`.
- Package tests SHOULD load helpers with `load "/repo/pkgs/e2e-common/helpers.sh"` inside containerized runs.
- `pkgs/e2e-common` MUST NOT own behavior tests.
- Each project with E2E tests MUST expose `e2e` in its `moon.yml` shaped like `bats ./e2e/*.bats.sh`.
- E2E tests SHOULD exercise the compiled CLI binary, not provider internals.
- Do not add empty E2E tasks or placeholder Bats files.

## Workflow

1. Trace current behavior before writing tests.
   - Inspect relevant CLI command/provider/core path.
   - Check existing `e2e/` files for nearest pattern.
   - Grep/call-trace all callers when touching shared behavior.

2. State current E2E flow as a small state machine.

   ```text
   manifest/input -> CLI command -> planning/validation -> apply/output -> filesystem/status assertion
   ```

3. Pick owning project.
   - CLI command behavior -> `apps/cli/e2e/`
   - manifest discovery/planning/validation -> `pkgs/core/e2e/`
   - plugin behavior -> `pkgs/plugin/e2e/`
   - provider behavior -> owning `pkgs/provider-*/e2e/`

4. Add the smallest Bats test that proves the behavior.
   - Use existing helpers when possible.
   - Isolate `HOME` and fixture state.
   - Assert status and at least one stable output or filesystem effect.
   - Include negative path when behavior has validation/safety branches.

5. Add or adjust Moon task only if real E2E tests now exist for that project.
   - Keep task in project `moon.yml`.
   - Do not add package.json scripts.

6. Validate with the narrowest command first.
   - Prefer `moon run <project>:e2e` when runnable.
   - If container-only assumptions matter, run `moon run repo:demoe2e`.
   - If code changed, also run relevant `typecheck`/`test` target.

## Output required

Report only:

- files changed
- tests added/changed
- validation command and result
- skipped scope, if any

Blunt rule: do not build a test framework. Reuse helpers. Smallest useful coverage wins.
