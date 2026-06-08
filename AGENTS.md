# AGENTS.md

## Project

Boxfiles is a Bun + TypeScript CLI/GUI for workstation provisioning: low-ceremony Ansible-lite with manifests/modules, context facts, plan compilation, and plan execution.

## Runtime and tooling

- Use **Bun** for package management and execution.
- Install deps with `bun install` or `mise run install`.
- Run the app with `bun run index.ts`, `bun run start`, or `mise run start`.
- Typecheck with `bun run typecheck` or `mise run typecheck`.
- Build release binaries with `bun run build`, `mise run build`, or `.mise/tasks/build`.
- Build outputs go to `dist/`: linux x64/arm64, macOS darwin x64/arm64, windows x64 exe.
- Project-local mise config lives at `.mise/config.toml`; file tasks live in `.mise/tasks/*`.
- If mise refuses to run tasks, trust the local config with `mise trust .mise/config.toml`.
- Beware global mise config leakage on this machine: if `mise run` attempts unrelated global tool installs, validate task bodies directly with `.mise/tasks/<name>` and report the leakage.
- Use TypeScript ES modules. Keep imports explicit and extensionless unless repo policy changes.

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

## Prohibitions

- MUST NOT introduce broad `Record<string, any>` shapes. Replace with typed records or `unknown` plus validation.
- MUST NOT mix discovery, parsing, planning, and execution in one function.
- MUST NOT silently swallow filesystem, parse, or execution errors.
- MUST NOT add framework/library dependencies without clear need.
