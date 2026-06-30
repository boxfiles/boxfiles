## Thinking

Research unit: `.memory/research-efc28c3a-context-liquidjs-liquidjs-capabilities.md`.

Skills discovered/used conceptually:
- `typescript-styleguide`: Boxfiles is TypeScript; LiquidJS API/type behavior matters.

Research facets:
1. LiquidJS extension APIs: filters, tags, drops.
2. Context resolution: globals, render scopes, strict variables, own-property access.
3. Async rendering and TypeScript API surface.
4. Security boundaries: sandboxing, DoS limits, file access, advisories.

## Research

### LiquidJS can mediate context access through custom extension points

**Claim: HIGH confidence.** LiquidJS supports Drops, filters, tags, globals, strict variables, and async rendering. These are enough to expose Boxfiles context through an approved template function surface.

Evidence, accessed 2026-06-29:
- LiquidJS Drops docs, official docs, Harttle/LiquidJS: https://liquidjs.com/tutorials/drops.html
- LiquidJS filter/tag docs, official docs, Harttle/LiquidJS: https://liquidjs.com/tutorials/register-filters-tags.html
- LiquidJS scope-in-filter docs, official docs, Harttle/LiquidJS: https://liquidjs.com/tutorials/access-scope-in-filters.html
- LiquidJS API docs, official docs, Harttle/LiquidJS: https://liquidjs.com/api/classes/Liquid.html

Drops can make dotted property access route through methods and `liquidMethodMissing`, but that is a broad surface. Filters/tags are narrower: `{{ "user.home" | fact }}` or `{% fact "user.home" %}` forces explicit context access.

### Async rendering should be the default boundary

**Claim: HIGH confidence.** LiquidJS supports async rendering, and Drops/custom tags can return Promises. Sync rendering can render Promises incorrectly if async behavior leaks into sync paths.

Evidence, accessed 2026-06-29:
- LiquidJS sync/async docs, official docs, Harttle/LiquidJS: https://liquidjs.com/tutorials/sync-and-async.html
- LiquidJS Drops docs, official docs, Harttle/LiquidJS: https://liquidjs.com/tutorials/drops.html

Boxfiles context resolvers already allow async fact gathering, so the lazy safe path is to gather facts first, then render templates async-only. No mixed sync mode unless measured need exists.

### Strict options help enforce function-only access

**Claim: HIGH confidence.** `strictVariables` and `strictFilters` can fail missing variables/filters instead of silently rendering empty output. This helps reject direct context reads like `{{ user.home }}` when only `{{ "user.home" | fact }}` is allowed.

Evidence, accessed 2026-06-29:
- LiquidJS options docs, official docs, Harttle/LiquidJS: https://liquidjs.com/tutorials/options.html
- LiquidJS options API, official API, Harttle/LiquidJS: https://liquidjs.com/api/interfaces/LiquidOptions.html

### LiquidJS is not a sandbox

**Claim: HIGH confidence.** LiquidJS docs describe limits as cooperative safeguards, not runtime isolation. Custom Drops and filters are privileged host code.

Evidence, accessed 2026-06-29:
- LiquidJS security model, official docs, Harttle/LiquidJS: https://liquidjs.com/tutorials/security-model.html
- GitHub Security Advisories, upstream advisory channel: https://github.com/harttle/liquidjs/security/advisories
- NVD CVE example for LiquidJS, NIST: https://nvd.nist.gov/vuln/detail/CVE-2022-25948
- OSV advisory query API, OpenSSF/Google: https://api.osv.dev/v1/query

Use `ownPropertyOnly`, `strictVariables`, `strictFilters`, `dynamicPartials: false`, bounded roots, parse/render/memory limits, and process-level timeout/isolation when templates are untrusted.

## Verification

Source matrix, accessed 2026-06-29:

- LiquidJS Drops docs — official docs, Harttle/LiquidJS — https://liquidjs.com/tutorials/drops.html — verifies Drops, `liquidMethodMissing`, async methods, `toLiquid`, `valueOf`.
- LiquidJS Register Filters/Tags — official docs, Harttle/LiquidJS — https://liquidjs.com/tutorials/register-filters-tags.html — verifies custom filter/tag APIs.
- LiquidJS Access Scope in Filters — official docs, Harttle/LiquidJS — https://liquidjs.com/tutorials/access-scope-in-filters.html — verifies filters can access render context.
- LiquidJS Sync and Async — official docs, Harttle/LiquidJS — https://liquidjs.com/tutorials/sync-and-async.html — verifies async/sync caveats.
- LiquidJS Options/API — official docs/API, Harttle/LiquidJS — https://liquidjs.com/tutorials/options.html and https://liquidjs.com/api/interfaces/LiquidOptions.html — verifies strictness, globals, own-property, limits.
- LiquidJS Security Model — official docs, Harttle/LiquidJS — https://liquidjs.com/tutorials/security-model.html — verifies non-sandbox boundary.
- npm registry metadata — npm — https://registry.npmjs.org/liquidjs/latest — verifies package metadata/version when checked by subagent.
- OSV/GitHub/NVD advisories — advisory databases — https://api.osv.dev/v1/query , https://github.com/harttle/liquidjs/security/advisories , https://nvd.nist.gov/vuln/detail/CVE-2022-25948 — verifies security history.

Contradictions:
- `ownPropertyOnly` default appears version-sensitive: docs/source may disagree. Set it explicitly instead of trusting defaults.

## Insights

- Best minimal fit for Boxfiles: one explicit `fact` filter/tag. It preserves flat dotted keys and centralizes errors.
- Drops are powerful but too broad for first migration; use only if template ergonomics matter more than auditability.
- Do not move context resolvers into Liquid. Resolver timing stays fact-gathering.
- Async-only rendering is simpler than supporting sync and async surfaces.

## Summary

LiquidJS can support context-as-template-functions. Use it as a narrow rendering facade, not a fact store. Prefer `{{ "fact.key" | fact }}` over raw `facts.foo` or Drops for the first migration. Set strict/security options explicitly and treat templates as privileged unless isolated.
