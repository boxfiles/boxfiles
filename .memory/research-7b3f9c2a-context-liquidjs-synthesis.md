## Thinking

Research unit: `.memory/research-7b3f9c2a-context-liquidjs-synthesis.md`.

Parent topic: swapping out how context provider works in Boxfiles with LiquidJS so all access of context is via template functions.

Subtopic units synthesized:
- `.memory/research-efc28c3a-context-liquidjs-liquidjs-capabilities.md`
- `.memory/research-062e83a2-context-liquidjs-boxfiles-current-architecture.md`
- `.memory/research-2fdbae6e-context-liquidjs-design-migration-risks.md`
- `.memory/research-94e6b3ef-context-liquidjs-testing-compatibility.md`

Bias: [bias: ponytail/minimal-change] Prefer smallest seam that preserves current service boundaries and avoids new abstractions.

## Research

### Decision-grade conclusion

**Claim: HIGH confidence.** Do not replace `ContextService` with LiquidJS. Keep `ContextService` as the fact ledger and use LiquidJS only as the template-time read/expression facade.

Evidence:
- Boxfiles already centralizes fact storage/collision in `ContextService`: `pkgs/core/src/services/Context.ts:80:fa1`, `pkgs/core/src/services/Context.ts:97:bd1`.
- Project invariant says resolvers MUST run during fact gathering, not template evaluation: `AGENTS.md:52:6bd`.
- LiquidJS supports filters/tags/globals/strict rendering for an expression facade: https://liquidjs.com/tutorials/register-filters-tags.html , https://liquidjs.com/tutorials/options.html . Accessed 2026-06-29. Source type: official docs. Publisher: Harttle/LiquidJS.

### Recommended minimal architecture

```text
[plugins resolve facts]
        |
        v
[ContextService snapshot]
        |
        v
[LiquidJS renderer]
  strictVariables: true
  strictFilters: true
  ownPropertyOnly: true
  dynamicPartials: false
  custom filter/tag: fact
        |
        v
[ManifestService.compile]
  render string/template-bearing fields
  before provider.validate
        |
        v
[PlanService / PlanExecutor]
```

Recommended public template surface:

```liquid
{{ "user.home" | fact }}
{{ "os.platform" | fact }}
```

Not recommended as first step:

```liquid
{{ facts.user.home }}
{{ user.home }}
```

Reason: Boxfiles facts are flat dotted keys (`Readonly<Record<string, unknown>>`), while Liquid dot syntax means nested traversal. A `fact` accessor preserves current semantics and gives one guard point.

### Integration seam

**Claim: HIGH confidence.** First implementation should go in `ManifestService.compile`, before provider validation.

Evidence:
- `ManifestService.compile` already accepts context but ignores it: `pkgs/core/src/services/Manifest.ts:174:f0d`, `pkgs/core/src/services/Manifest.ts:178:9bb`.
- Provider config validation happens later in `resolveStep`: `pkgs/core/src/services/Manifest.ts:230:b32`, `pkgs/core/src/services/Manifest.ts:240:58e`.
- Existing tests can focus there: `pkgs/core/test/Manifest.test.ts` already tests manifest compile behavior.

### Security posture

**Claim: HIGH confidence.** LiquidJS must not be treated as a sandbox.

Evidence, accessed 2026-06-29:
- LiquidJS security model says limits are cooperative safeguards, not strict runtime isolation: https://liquidjs.com/tutorials/security-model.html . Official docs. Publisher: Harttle/LiquidJS.
- PortSwigger SSTI guidance treats dynamic/user-editable templates as risky: https://portswigger.net/web-security/server-side-template-injection . Security training/research. Publisher: PortSwigger.
- Nunjucks official docs warn it does not sandbox execution: https://mozilla.github.io/nunjucks/api.html . Official docs. Publisher: Mozilla/Nunjucks.
- Handlebars prototype-access restrictions exist because prototype methods/properties caused security issues: https://handlebarsjs.com/api-reference/runtime-options.html . Official docs. Publisher: Handlebars.

Boxfiles defaults should be explicit: `strictVariables: true`, `strictFilters: true`, `ownPropertyOnly: true`, `dynamicPartials: false`, no file includes unless a real use case exists, plus bounded render limits.

### Migration sequence

1. Inventory direct context/facts reads: `ctx.facts`, `snapshot()`, `ContextService.get`, manifest `when`, action `with` fields.
2. Add one LiquidJS wrapper for context-expression rendering.
3. Register one `fact` filter/tag backed by the gathered snapshot.
4. Render manifest string fields before provider validation.
5. Keep non-template manifests pass-through.
6. Add negative tests for direct context/property access.
7. Later: deprecate/wrap provider `ActionContext.facts` if “all access” must include provider internals.

## Verification

Confidence matrix:

- Keep `ContextService`; LiquidJS facade only — **HIGH**. Supported by repo invariants and LiquidJS extension docs.
- Use explicit `fact` accessor over raw globals/Drops — **HIGH**. Supported by flat-key repo model plus LiquidJS docs.
- Put rendering in `ManifestService.compile` before `provider.validate` — **HIGH**. Supported by local code seams.
- Async-only rendering — **MEDIUM-HIGH**. LiquidJS async docs plus Boxfiles async resolver support; no measured sync need found.
- Disable dynamic partials/includes by default — **MEDIUM-HIGH**. Security best practice from LiquidJS docs and SSTI guidance; exact product need unknown.

Contradictions:
- User phrasing suggests swapping the context provider itself. Repo invariants reject that direction. Safer interpretation: swap context *access* to LiquidJS template functions, not fact gathering.
- LiquidJS Drops can make dotted access ergonomic, but design/security research recommends avoiding Drops first. Ergonomics vs auditability. Minimal/auditable wins.
- LiquidJS option defaults appear version-sensitive (`ownPropertyOnly` docs/source disagreement). Explicit config avoids the contradiction.

## Insights

- The core problem is not templating. It is preserving flat fact keys and resolver timing while adding user-facing template reads.
- Provider `ctx.facts` is the policy hole. If left alone, templates use functions but provider code still has direct context access. That may be acceptable for phase 1; it is not “all access.”
- Test only Boxfiles contracts. Do not copy LiquidJS’ whole test matrix.
- Avoid adding a new abstraction layer around every provider now. One renderer + one filter is enough.

## Summary

Use LiquidJS, but do less: keep fact gathering unchanged, add a strict Liquid renderer at `ManifestService.compile`, expose one flat-key `fact` template function/filter, render before provider validation, and test pass-through/missing/direct-access failures. Do not expose raw `facts`, do not use Drops first, and do not pretend LiquidJS is a sandbox.
