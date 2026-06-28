# Research: npm OS fact packages synthesis

## Thinking

Parent topic: npmjs packages we can use to gather facts about the OS regardless of macOS, Linux, Windows, and BSD.

Sub-research files:
- [system inventory](./research-1f014754-npm-os-facts-system-inventory.md)
- [platform compatibility](./research-31504b95-npm-os-facts-platform-compatibility.md)
- [maintenance risk](./research-8f0a68fe-npm-os-facts-maintenance-risk.md)
- [Boxfiles fit](./research-bf800953-npm-os-facts-boxfiles-fit.md)

[bias: ponytail/minimal-dependency] For Boxfiles, facts are provisioning context, not a hardware inventory product. Prefer built-ins and tiny read-only probes until a concrete manifest feature needs more.

## Research

### Recommendation

1. **Boxfiles default: no npm package.** Use `node:os`, `process.platform`, `process.arch`, and read-only OS files like `/etc/os-release` on Linux.
2. **Broad inventory fallback: `systeminformation`.** Best single npm package when we need rich OS/hardware/network/storage/service facts across macOS, Linux, Windows, and BSD.
3. **Narrow optional Linux supplement: `detect-libc`.** Add only if package planning needs exact glibc vs musl facts.
4. **Diagnostic report only: `envinfo`.** Useful for support/debug output, not provider-os baseline facts.
5. **Avoid for new provider-os work:** `os-utils`, `getos`, and probably `node-os-utils` unless we need live monitoring metrics.

### Package map

| Package | Use | Confidence | Reason |
|---|---|---:|---|
| `node:os` | baseline | HIGH | Official Node and Bun-supported API; no dependency. |
| `systeminformation` | rich inventory | HIGH | Explicit broad OS support including BSDs; active maintenance; no runtime deps. |
| `detect-libc` | Linux libc fact | HIGH | Narrow, maintained, zero runtime deps. |
| `envinfo` | diagnostics | HIGH | Strong adoption; reports dev environment facts. Privacy/redaction concern. |
| `node-os-utils` | monitoring | MEDIUM | Active v2 but narrower platform scope; privilege friction. |
| `getos` | reject/legacy Linux distro | MEDIUM | Linux distro-only and older. |
| `os-utils` | reject | HIGH | Stale and limited. |

## Verification

Evidence summary, access date 2026-06-28:

- Node official docs: `node:os` provides platform/release/version/type/arch/machine/hostname/user/cpu/memory/network facts. Source type: official docs. Publisher: Node.js. Confidence: HIGH.
- Bun official docs: Bun exposes Node-compatible `os` API. Source type: official docs. Publisher: Bun. Confidence: HIGH.
- Linux `os-release(5)`: standard Linux distro metadata source. Source type: manual page. Publisher: Linux man-pages project. Confidence: HIGH.
- `systeminformation`: npm registry, GitHub README/API, official docs all agree on broad inventory scope and current maintenance. Confidence: HIGH.
- `detect-libc`: npm registry and GitHub README agree on Linux libc detection scope. Confidence: HIGH.
- `envinfo`: npm registry and GitHub README agree it is a support-report/dev-environment tool. Confidence: HIGH. Contradiction: GitHub release metadata showed newer tag than npm latest in one sub-research; pin from npm, not GitHub tag.
- `node-os-utils`: npm/GitHub docs show active v2 and monitoring scope, but not BSD-oriented. Confidence: MEDIUM.
- `getos`/`os-utils`: npm/GitHub metadata show narrow or stale packages. Confidence: MEDIUM-HIGH.

## Insights

- Do not add `systeminformation` just to get `os.platform`. That is dependency bloat.
- If provider-os grows into hardware/network inventory, `systeminformation` is the one dependency worth paying for.
- BSD is the forcing function. Most packages are macOS/Linux/Windows-first. `systeminformation` is the only researched npm package with explicit FreeBSD/OpenBSD/NetBSD claims.
- Normalize facts behind Boxfiles-owned names (`os.platform`, `os.distro.id`, `os.arch`, `os.libc.family`) so package choice can change later.

## Summary

For Boxfiles provider-os: implement built-ins first. Add a tiny `/etc/os-release` parser for Linux distro. Keep `detect-libc` as optional future dependency. Reach for `systeminformation` only if the scope expands to rich inventory. Skip `envinfo`, `node-os-utils`, `getos`, and `os-utils` for baseline OS facts.
