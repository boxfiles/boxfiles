# AGENTS.md

## Project

Boxfiles is a Bun + TypeScript CLI/GUI for workstation provisioning: low-ceremony Ansible-lite with manifests/modules, context facts, plan compilation, and plan execution.

Also read and respect any AGENTS.md found in any pkgs/apps dir.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `boxfiles/boxfiles`. See `.memory/docs/agents/issue-tracker.md`.

### Triage labels

Triage uses default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `.memory/docs/agents/triage-labels.md`.

### Domain docs

Domain docs use multi-context layout via root `CONTEXT-MAP.md`. See `.memory/docs/agents/domain.md`.

## Runtime and tooling

- Use **Bun** for package management and execution.
- Install deps with `bun install`.
- Run the app with `moon run cli:start` or `bun run apps/cli/src/index.ts`.
- Typecheck with `moon run repo:typecheck`.
- Build release binaries with `moon run repo:build` or `moon run cli:publish`.
- Build outputs go to `dist/`: linux x64/arm64, macOS darwin x64/arm64, windows x64 exe.
- Moon config lives at `.moon/`; project tasks live in `moon.yml` files.
- Use `moonrepo/setup-toolchain` in CI for toolchain setup.
- Keep workflow commands in repo `moon.yml` files; do not hide task logic in shell wrappers unless needed.
- Use TypeScript ES modules. Keep imports explicit and extensionless unless repo policy changes.


## Plugin architecture

- Plugins are capability modules, not action-only providers.
- Built-in providers MUST live at `pkgs/provider-{capability}/src/index.ts`.
- Built-in provider file basename SHOULD match plugin `id`.
- Simple built-in action provider kind SHOULD match capability name.
- `ActionProvider` MUST be generic over its TypeBox config schema so `validate()`, `plan()`, and `apply()` share one config type source.
- Resolver functions MUST run during fact gathering, not template evaluation.
- Resolver functions MUST NOT mutate workstation state.
- Plugin context fact tokens MUST be namespaced by capability, for example `user.name` or `os.platform`.
- Plugin fact collision default MUST be `error`.
- Built-in apply functions MAY stay stubbed until execution safety policy exists.

## CLI framework

Framework: [CrustJS](https://github.com/chenxin-yan/crust/blob/main/apps/docs/content/docs/api/index.mdx)
Language: TypeScript
Compiler: Bun

- Use **CrustJS** for CLI routing.
- Root command currently has a variadic fallback `.run()` for unknown command-like args.
- Known commands should be registered with `.command(name, cb)` and strongly typed args/flags.
- Keep plugin order intentional: `versionPlugin` -> `didYouMeanPlugin` -> `helpPlugin` unless a concrete reason exists.
- Do not bypass Crust routing with ad-hoc `process.argv` parsing unless implementing a narrow compatibility shim.

## Planning memory

Skill: `project-planning`
Storage Strategy: `basic-memory`
Basic Memory Project: `Boxfiles`

When reading/writing project plans, design notes, and long-lived decisions use `project-planning` skill with the basic-memory storage strategy.

- Resolve user requests to the `project-planning/workflow/behaviour-tree` and `project-planning/status-flow` references.
- Before large changes, check existing planning notes if available.
- After meaningful design decisions, store concise notes in `project-planning`.
- Do not store secrets, local machine paths with credentials, or private tokens.

## Coding workflow

- Prefer small, typed changes over large rewrites.
- Before changing behavior, identify current state, target state, and invariant being preserved.
- Add or update tests when behavior becomes non-trivial.
- Validate with observable output: typecheck, tests, or focused command execution.

## Testing and e2e

- Unit tests SHOULD stay near the package that owns the code under test.
- Real CLI smoke tests MUST be Bats tests named `*.bats.sh` under the owning project `e2e/` directory, for example `pkgs/provider-copy/e2e/copy.bats.sh`.
- Shared e2e helpers MUST live in `pkgs/e2e-common/helpers.sh`; package e2e tests SHOULD load helpers with `load "/repo/pkgs/e2e-common/helpers.sh"` inside the container.
- `pkgs/e2e-common` MUST NOT own behavior tests. It is shared test infrastructure only.
- Each project with e2e tests MUST expose a Moon task shaped as `e2e: bats ./e2e/*.bats.sh`.
- The containerized demo runner SHOULD execute `moon run :e2e` so Moon fans out to each package-owned e2e task.
- E2E tests SHOULD exercise real user flows through the compiled CLI binary, not provider internals.
- Do not add empty `e2e` tasks or placeholder Bats files. Add package e2e ownership only when real behavior exists.
- Root `repo:demoe2e` inputs MUST include package e2e files, `pkgs/e2e-common/**`, CLI source, provider/core/plugin source, and `Containerfile` so cache hits do not hide behavior changes.
## Refactoring

- MUST NOT use package barrel exports to hide ownership. Import from the package that owns the symbol.
- MUST NOT make `@boxfiles/core` re-export sibling packages as convenience API.
- SHOULD remove pass-through exports during package moves unless compatibility is explicitly required.
- SHOULD update callers to direct imports before deleting or moving modules.
- MUST verify dependency direction after refactors: feature packages may depend on core; core MUST NOT become a dumping ground for unrelated package APIs.

## TypeScript rules

- `strict` mode is enabled. Treat type errors as blockers.
- MUST NOT use `any`. Use `unknown`, discriminated unions, branded IDs, generics, or explicit domain types.
- MUST NOT weaken `tsconfig.json` strictness to make code pass.
- MUST model domain concepts with strong types:
  - manifest/module IDs
  - dependency edges
  - context facts
  - plan steps
  - action kinds and action inputs
- Prefer `readonly` data where mutation is not required.
- Prefer exhaustive `switch` over stringly branching. Use `never` exhaustiveness checks.
- Avoid destructuring fields from objects (prop params for example). Instead just access them via dot notation. This makes it easier to see the source of values and refactor types without changing call sites.

## Nevernester style

- Avoid deep nesting. Use guard clauses, early returns, extraction, and small pure functions.
- MUST qualify cheapest failure paths first. return eearly on easiest output values, missing files, parse errors, failed conditions, etc.
- Maximum practical nesting depth: 1 levels. If deeper, refactor before extending.
- Keep functions focused on one decision or transformation.
- Avoid hidden side effects in services. Parsing, planning, and execution should be separate phases.

Current service boundaries:

- `ContextService`: gathers and stores facts.
- `Manifest`: opens/parses/validates manifest files.
- `PlanService`: turns manifests + context into typed executable plan.

Keep these boundaries unless you can explain why they are wrong.

## Prohibitions

- MUST NOT introduce broad `Record<string, any>` shapes. Replace with typed records or `unknown` plus validation.
- MUST NOT mix discovery, parsing, planning, and execution in one function.
- MUST NOT silently swallow filesystem, parse, or execution errors.
- MUST NOT add framework/library dependencies without clear need.
