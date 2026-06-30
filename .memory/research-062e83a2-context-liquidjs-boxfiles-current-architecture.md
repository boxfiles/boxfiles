## Thinking

Research unit: `.memory/research-062e83a2-context-liquidjs-boxfiles-current-architecture.md`.

Skills discovered/used:
- `typescript-styleguide`: relevant because core change is TypeScript.
- Semantic repo exploration via file maps, AST search, LSP attempts, and targeted reads.

No code edits. No worktree.

## Research

### Current flow

```text
[CLI route]
   |
   v
[createCliRuntime]
   | registers built-in plugins
   v
[PluginRegistry]
   |
   v
[gatherRuntimeContextSnapshot]
   |
   v
[ContextService]
   | stores flat facts
   v
[ManifestService.plan({ facts })]
   |
   v
[ManifestService.compile]
   | parses YAML/TOML, validates provider config
   | template interpolation NOT implemented
   v
[PlanService]
   | passes ctx.facts to action providers
   v
[PlanExecutor]
   | passes ctx.facts again during apply
```

### Current architecture claims

**Claim: HIGH confidence.** `ContextService` is the canonical fact ledger and collision-policy boundary.

Evidence:
- `ContextService` stores facts in a private `Map<FactKey, ContextFact>`: `pkgs/core/src/services/Context.ts:80:fa1`, `pkgs/core/src/services/Context.ts:81:77d`.
- Fact values are `unknown`; snapshots are `Readonly<Record<string, unknown>>`: `pkgs/core/src/services/Context.ts:44:6b1`, `pkgs/core/src/services/Context.ts:47:300`, `pkgs/core/src/services/Context.ts:63:ea2`.
- `ContextService.set` enforces `error`, `keep-first`, `override`: `pkgs/core/src/services/Context.ts:97:bd1`, `pkgs/core/src/services/Context.ts:104:730`.
- Plugin gathering hardcodes default collision handling to `error`: `pkgs/plugin/src/runtime.ts:332:e34`, `pkgs/plugin/src/runtime.ts:336:b29`.

**Claim: HIGH confidence.** Resolver functions already run at fact gathering time, not template evaluation time.

Evidence:
- `ContextResolver = (ctx) => JsonValue | undefined | Promise<...>`: `pkgs/core/src/services/Context.ts:70:e57`, `pkgs/core/src/services/Context.ts:76:394`.
- `gatherPluginContextFacts` resolves static/resolver entries and stores non-undefined facts: `pkgs/plugin/src/runtime.ts:327:631`, `pkgs/plugin/src/runtime.ts:330:9f2`, `pkgs/plugin/src/runtime.ts:331:74c`, `pkgs/plugin/src/runtime.ts:338:d08`.
- Resolver context receives previous facts via `contextService.snapshot()`: `pkgs/plugin/src/runtime.ts:330:9f2`.
- Project invariant says resolvers MUST run during fact gathering: `AGENTS.md:52:6bd`.

**Claim: HIGH confidence.** Manifest compilation has a deliberate empty seam for template interpolation.

Evidence:
- `ManifestService.compile` accepts `_context` but ignores it: `pkgs/core/src/services/Manifest.ts:174:f0d`, `pkgs/core/src/services/Manifest.ts:176:8d7`, `pkgs/core/src/services/Manifest.ts:178:9bb`, `pkgs/core/src/services/Manifest.ts:179:bd9`.
- Step `with` stays `unknown` until provider validation: `pkgs/core/src/services/Manifest.ts:44:a96`.
- `resolveStep` validates `step.with ?? {}` before storing typed config: `pkgs/core/src/services/Manifest.ts:230:b32`, `pkgs/core/src/services/Manifest.ts:235:4ca`, `pkgs/core/src/services/Manifest.ts:240:58e`, `pkgs/core/src/services/Manifest.ts:253:b1b`.

**Claim: HIGH confidence.** Providers still receive raw facts during plan/apply, so “all access via template functions” is not true until that policy is addressed.

Evidence:
- `PlanService.compile` passes `ctx.facts` to provider `plan`: `pkgs/core/src/services/Plan.ts:124:099`, `pkgs/core/src/services/Plan.ts:125:f76`, `pkgs/core/src/services/Plan.ts:128:2d5`, `pkgs/core/src/services/Plan.ts:130:d45`.
- `PlanExecutor.execute` passes `ctx.facts` to provider `apply`: `pkgs/core/src/services/Plan.ts:193:069`, `pkgs/core/src/services/Plan.ts:196:2d3`.
- `ActionContext.facts` is still part of the provider contract: `pkgs/core/src/services/Actions.ts:16:e99`, `pkgs/core/src/services/Actions.ts:18:472`.

### Built-in providers

- CLI runtime registers built-ins: `apps/cli/src/runtime.ts:21:de3`, `apps/cli/src/runtime.ts:23:0a5`, `apps/cli/src/runtime.ts:24:89a`.
- OS provider exposes context via `createOsContext()`: `pkgs/provider-os/src/index.ts:4:06f`, `pkgs/provider-os/src/index.ts:6:2d2`.
- User provider exposes context via `createUserContext()`: `pkgs/provider-user/src/index.ts:4:06f`, `pkgs/provider-user/src/index.ts:6:dd4`.
- OS/user context creates one resolver per known key and caches snapshots: `pkgs/provider-os/src/facts.ts:33:2f2`, `pkgs/provider-os/src/facts.ts:50:f31`; `pkgs/provider-user/src/facts.ts:22:2f2`, `pkgs/provider-user/src/facts.ts:30:4e5`.

### Integration point for LiquidJS

```text
[CLI route]
   |
   v
[gather facts once]
   |
   v
[ContextSnapshot]
   |
   v
[Liquid environment]
   | registers only approved template functions:
   |   fact("user.home") / hasFact("os.platform")
   v
[ManifestService.compile]
   | render template-bearing strings/objects before provider validation
   v
[provider.validate]
   |
   v
[PlanService.provider.plan]
   |
   v
[PlanExecutor.apply]
```

Best seam: `ManifestService.compile(context)`, before `provider.validate(step.with ?? {})`. It already accepts context and has the TODO/placeholder.

## Verification

Repo sources read:
- `CONTEXT-MAP.md`
- `CONTEXT.md`
- `AGENTS.md`
- `pkgs/core/CONTEXT.md`
- `pkgs/plugin/CONTEXT.md`
- `pkgs/provider-user/CONTEXT.md`
- `pkgs/provider-os/CONTEXT.md`
- `pkgs/core/src/services/Context.ts`
- `pkgs/core/src/services/Manifest.ts`
- `pkgs/core/src/services/Plan.ts`
- `pkgs/core/src/services/Actions.ts`
- `pkgs/plugin/src/runtime.ts`
- `pkgs/plugin/src/registry.ts`
- `apps/cli/src/runtime.ts`
- `pkgs/provider-os/src/index.ts`
- `pkgs/provider-user/src/index.ts`

Contradictions:
- User goal says “swapping out how context provider works”; repo invariant says resolver functions MUST run during fact gathering. So LiquidJS should not replace provider gathering. It should replace template-time/read access only.

## Insights

- Do not delete `ContextService`; it owns collision behavior and fact snapshots.
- Put Liquid rendering in `ManifestService.compile`, before provider validation.
- Expose context through explicit Liquid function/filter, not raw globals.
- Provider `ActionContext.facts` is the remaining direct-access leak. Deprecate/wrap later, after manifest rendering works.

## Summary

Current Boxfiles already has a clean gather-once fact pipeline. LiquidJS should consume the completed snapshot through a narrow template-function API during manifest compilation. Smallest useful change: render manifest strings before provider validation. Bigger policy change: remove or wrap provider direct `ctx.facts` access later.
