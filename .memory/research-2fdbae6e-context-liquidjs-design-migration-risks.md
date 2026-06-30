## Thinking

Search facets used: (1) LiquidJS mechanics/options/static analysis/security, (2) Liquid language semantics from Shopify, (3) template-injection/sandbox risks and contrast engines, (4) TypeScript/Bun migration/testing constraints. Skill discovery was attempted before research; no discover/read skill tools were available in this session and no local `SKILL.md` files were found under `/home/zenobius/.pi`, so no named skill was loaded. I used the requested miniproject convention conceptually and wrote this single research unit to `.memory/research-2fdbae6e-context-liquidjs-design-migration-risks.md`.

## Research

### 1. Viable architecture pattern: Liquid as a narrow expression/rendering facade, not as the canonical data store

**Claim, high confidence:** LiquidJS can be the only *template-time* context access API if Boxfiles keeps a small wrapper around the existing gathered snapshot and exposes only explicit filters/tags/functions for fact lookup. Do not let arbitrary code read the snapshot directly from templates.

Evidence:
- Liquid templates output variables and use tags for control flow; Shopify defines objects as values displayed with `{{ }}` and tags as logic/control flow. That supports using Liquid as an expression language, but not as a typed domain model. Accessed 2026-06-29. Source type: official language docs. Publisher: Shopify. URL: https://shopify.github.io/liquid/basics/introduction/
- LiquidJS supports registering filters/tags and TypeScript examples. Custom filters can receive arguments, and stateful filters can read scope via `this.context.get(...)`. Accessed 2026-06-29. Source type: official implementation docs. Author/publisher: Harttle/LiquidJS. URLs: https://liquidjs.com/tutorials/register-filters-tags.html and https://liquidjs.com/tutorials/access-scope-in-filters.html
- LiquidJS has static analysis APIs (`variables`, `fullVariables`, `variableSegments`, `globalVariables`, `globalVariableSegments`) that can inventory template variable dependencies before rendering. This is directly useful for migration audits and CI gates. Accessed 2026-06-29. Source type: official implementation docs. Author/publisher: Harttle/LiquidJS. URL: https://liquidjs.com/tutorials/static-analysis.html
- Boxfiles today has `ContextService` as the canonical store, collision policy, and `snapshot()`; plugins gather facts by resolving `ContextEntry` values against `{ rootDir, pluginId, facts }`. This suggests the smallest architecture is to preserve gathering/storage and route expression resolution through Liquid at the edges, not delete the store first. Source type: local code. URL/path: `pkgs/core/src/services/Context.ts`, `pkgs/plugin/src/runtime.ts`.

Recommended shape:
- Keep `ContextService` as the fact registry and collision/missing-value policy.
- Add one narrow resolver, conceptually `renderContextTemplate(template, snapshot, options)`.
- Expose fact lookup through one auditable Liquid surface, e.g. a filter/tag like `{{ "runtime.local.os" | fact }}`, rather than exposing `facts` broadly.
- Use `strictVariables: true` for migrated paths where missing facts should fail.
- Use LiquidJS static analysis to list globals/templates before migration and reject unknown direct variables.

Why a custom fact function/filter matters: Boxfiles fact keys are flat dotted strings (`runtime.local.os`). Native Liquid `page.title` means object traversal, not necessarily a flat key lookup. `{{ facts.runtime.local.os }}` would require a nested object projection and can drift from current flat-key semantics. `{{ "runtime.local.os" | fact }}` preserves existing keys and gives one guard point.

### 2. Major migration risks

**A. Security boundary and sandbox assumptions — high confidence.** Treat templates as code-like input when users/plugins can author them.

Evidence:
- LiquidJS explicitly says built-in limits are cooperative safeguards, not strict runtime isolation; they do not sandbox JavaScript execution and should be combined with process/container limits and request timeouts. Accessed 2026-06-29. Source type: official implementation security docs. Author/publisher: Harttle/LiquidJS. URL: https://liquidjs.com/tutorials/security-model.html
- PortSwigger distinguishes safe static templates with data values from vulnerable dynamic template construction, and warns that user-editable templates are high risk. Accessed 2026-06-29. Source type: security training/research. Publisher: PortSwigger Web Security Academy. URL: https://portswigger.net/web-security/server-side-template-injection
- Nunjucks explicitly says it does not sandbox execution and is unsafe for user-defined templates or user-defined content in template definitions. This is a contrast source, but it supports the general rule that template engines are not security boundaries. Accessed 2026-06-29. Source type: official engine docs. Publisher: Mozilla/Nunjucks. URL: https://mozilla.github.io/nunjucks/api.html
- Handlebars forbids prototype access by default because prototype properties/methods created security issues and may allow arbitrary code execution or crashes if re-enabled. Accessed 2026-06-29. Source type: official engine docs. Publisher: Handlebars. URL: https://handlebarsjs.com/api-reference/runtime-options.html

LiquidJS-specific controls to prefer: `ownPropertyOnly: true`, `strictVariables: true`, `dynamicPartials: false` unless needed, bounded `root`/`partials`, no custom Drops for untrusted data, `parseLimit`/`renderLimit`/`memoryLimit` plus process-level timeouts for untrusted templates.

**B. File/include resolution risk — medium-high confidence.** Template include/render/layout support can turn context access into filesystem/template loading unless restricted.

Evidence:
- LiquidJS resolves `renderFile`, `parseFile`, `include`, and `layout` against `root`, `partials`, and `layouts`; relative roots resolve against `cwd()`. Accessed 2026-06-29. Source type: official implementation docs. Author/publisher: Harttle/LiquidJS. URL: https://liquidjs.com/tutorials/render-file.html
- LiquidJS `dynamicPartials` defaults to `true`, meaning include/render/layout filenames may be variables. Accessed 2026-06-29. Source type: official implementation docs. Author/publisher: Harttle/LiquidJS. URL: https://liquidjs.com/tutorials/options.html
- LiquidJS supports a custom abstract filesystem, which is powerful but expands the attack/bug surface if template names are user-controlled. Accessed 2026-06-29. Source type: official implementation docs. Author/publisher: Harttle/LiquidJS. URL: https://liquidjs.com/tutorials/render-file.html

Smallest safe default for a CLI/provisioner: disable dynamic partials, set explicit roots if file templates are needed, or avoid file includes for context expressions entirely.

**C. Type erosion and runtime-only failures — high confidence.** Moving from TypeScript functions/objects to template strings shifts errors from compile time to render time.

Evidence:
- LiquidJS variables are parsed from strings and can be analyzed, but they are not TypeScript property references. Static analysis returns string/segment paths; it does not prove schema correctness by itself. Accessed 2026-06-29. Source type: official implementation docs. Author/publisher: Harttle/LiquidJS. URL: https://liquidjs.com/tutorials/static-analysis.html
- Bun’s TypeScript recommendation includes `strict: true` and `noUncheckedIndexedAccess: true`, reinforcing that index/string access needs explicit handling. Accessed 2026-06-29. Source type: official runtime docs. Publisher: Oven-sh/Bun. URL: https://bun.sh/docs/runtime/typescript
- Current Boxfiles `ContextSnapshot` is `Readonly<Record<string, unknown>>`; fact values are unknown at read time already, so Liquid should not further hide validation. Source type: local code. URL/path: `pkgs/core/src/services/Context.ts`.

Mitigation: keep output validation at boundaries. For any manifest field rendered by Liquid, validate the rendered value with existing schema/typebox checks after rendering.

**D. Async/sync behavior changes — medium confidence.** LiquidJS supports both sync and async, but custom tags/filters that yield Promises cannot be used in sync rendering.

Evidence:
- LiquidJS async APIs return Promises; sync variants have `Sync` suffix. Custom tags must avoid Promise-returning APIs to remain sync-compatible. Accessed 2026-06-29. Source type: official implementation docs. Author/publisher: Harttle/LiquidJS. URL: https://liquidjs.com/tutorials/sync-and-async.html
- Current Boxfiles plugin context resolvers can be async (`ContextResolver` returns value or Promise). Source type: local code. URL/path: `pkgs/core/src/services/Context.ts`.
- LiquidJS render APIs include both `render()` and `renderSync()`; mixing them carelessly can create divergent behavior. Accessed 2026-06-29. Source type: official implementation docs. Author/publisher: Harttle/LiquidJS. URL: https://liquidjs.com/tutorials/sync-and-async.html

Recommendation: make the Boxfiles context-template API async-only unless there is a measured need for sync. One mode means fewer edge cases.

### 3. Recommended smallest viable migration path

1. **Inventory current access.** Grep all direct `facts[...]`, `snapshot()`, `ContextService.get`, and manifest interpolation points. Use LiquidJS `globalVariableSegments` on candidate templates to compare against known fact keys.
2. **Introduce one resolver wrapper.** Keep `ContextService` and plugin gathering unchanged. Add a single LiquidJS engine configured for context expressions: `ownPropertyOnly: true`, `strictVariables: true`, `dynamicPartials: false`, no file root unless needed, no Drops, tiny allowlist of filters/tags.
3. **Expose one fact accessor.** Prefer `{{ "fact.key" | fact }}` or an equivalent tag/function over raw `facts` object traversal. This preserves flat dotted-key semantics and centralizes missing/sensitive handling.
4. **Dual-run only at migration seams.** For each manifest/plugin context expression migrated, compare old resolver output and Liquid output in tests/golden fixtures, then delete the old path for that seam.
5. **Validate rendered outputs.** Render first, then feed results into existing schemas. Do not trust template output shape.
6. **Only then consider making Liquid “the only API.”** Once all reads route through the wrapper, remove direct callers. Do not remove `ContextService`; it still owns gathered facts, collision policy, and snapshots.

### 4. What to avoid

- Avoid exposing the full snapshot as `facts` plus allowing arbitrary path traversal; use one `fact` accessor.
- Avoid enabling template file includes/render/layout for context expressions unless a real use case exists.
- Avoid dynamic partial names in a provisioning CLI by default.
- Avoid custom Drop classes for context unless each exposed method is audited.
- Avoid migrating plugin context resolvers and manifest rendering in one jump; that mixes provider-order bugs with template bugs.
- Avoid treating `parseLimit`/`renderLimit`/`memoryLimit` as a sandbox.

## Verification

Sources kept:
- LiquidJS Security Model — https://liquidjs.com/tutorials/security-model.html — official docs for limits, `ownPropertyOnly`, Drops, and isolation warning. Accessed 2026-06-29. Publisher/author: Harttle/LiquidJS.
- LiquidJS Static Template Analysis — https://liquidjs.com/tutorials/static-analysis.html — official APIs for migration inventory. Accessed 2026-06-29. Publisher/author: Harttle/LiquidJS.
- LiquidJS Options — https://liquidjs.com/tutorials/options.html — official options for cache/root/partials/dynamicPartials/strictness. Accessed 2026-06-29. Publisher/author: Harttle/LiquidJS.
- LiquidJS Render Files — https://liquidjs.com/tutorials/render-file.html — official root/partials/filesystem behavior. Accessed 2026-06-29. Publisher/author: Harttle/LiquidJS.
- LiquidJS Register Filters/Tags and Access Scope in Filters — https://liquidjs.com/tutorials/register-filters-tags.html , https://liquidjs.com/tutorials/access-scope-in-filters.html — official extension points for the wrapper API. Accessed 2026-06-29. Publisher/author: Harttle/LiquidJS.
- LiquidJS Sync and Async — https://liquidjs.com/tutorials/sync-and-async.html — official async/sync behavior. Accessed 2026-06-29. Publisher/author: Harttle/LiquidJS.
- Shopify Liquid Introduction and Operators — https://shopify.github.io/liquid/basics/introduction/ , https://shopify.github.io/liquid/basics/operators/ — primary language semantics. Accessed 2026-06-29. Publisher: Shopify.
- PortSwigger SSTI — https://portswigger.net/web-security/server-side-template-injection — security model for dynamic template construction. Accessed 2026-06-29. Publisher: PortSwigger.
- Nunjucks API warning — https://mozilla.github.io/nunjucks/api.html — contrast engine warning against unsandboxed user templates. Accessed 2026-06-29. Publisher: Mozilla/Nunjucks.
- Handlebars runtime options — https://handlebarsjs.com/api-reference/runtime-options.html — contrast engine prototype-access security defaults. Accessed 2026-06-29. Publisher: Handlebars.
- Bun TypeScript docs — https://bun.sh/docs/runtime/typescript — TypeScript strictness context for CLI runtime. Accessed 2026-06-29. Publisher: Oven-sh/Bun.
- Local Boxfiles code — `pkgs/core/src/services/Context.ts`, `pkgs/plugin/src/runtime.ts`, `apps/cli/src/runtime.ts` — current architecture facts.

Sources dropped/noise:
- Wikipedia — intentionally not used.
- Generic templating tutorials and SEO pages — excluded because they do not address migration/security specifics.
- OWASP SSTI community URL attempted but returned 404; PortSwigger and engine docs covered the security claim better.

Contradictions / nuance:
- Liquid is often described as designer-safe or constrained, but LiquidJS itself says its limits are not isolation and do not sandbox JavaScript execution. Confidence: high.
- Handlebars defaults to forbidding prototype access, while LiquidJS `ownPropertyOnly` default is documented as `false`. So Boxfiles should set it explicitly rather than assume safe defaults. Confidence: high.
- Shopify Liquid compatibility favors dynamic partial behavior; provisioning CLI safety favors disabling it unless needed. Confidence: medium-high.

## Insights

The key architectural move is not “replace ContextService with Liquid.” It is “make Liquid the only expression/read surface while ContextService remains the fact ledger.” That gives one place to enforce flat-key lookup, missing-key behavior, sensitive-value rules, and schema validation.

The biggest hidden migration bug is dotted fact keys. Liquid dot syntax naturally means nested traversal; Boxfiles facts are currently flat keys. A custom `fact` accessor is the smallest way to avoid a broad data-shape migration.

Testing should be boring: golden fixtures for old-vs-new rendered outputs, one missing-key failure test, one dotted-key test, one malicious/prototype-ish lookup test, and one include-disabled test.

## Summary

Use LiquidJS as a narrow, configured context-expression facade, not as the storage layer. Smallest viable path: keep current fact gathering, add one Liquid resolver with strict/safe options, expose a single flat-key `fact` accessor, dual-run migrated seams, and validate rendered outputs. Avoid broad snapshot exposure, dynamic includes, Drops, and any assumption that LiquidJS limits are a sandbox.
