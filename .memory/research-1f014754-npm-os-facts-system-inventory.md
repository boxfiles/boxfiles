# Research: npm packages for broad cross-platform OS/system inventory facts in Node.js

## Thinking

Search facets used:
1. Broad inventory APIs: OS, hardware, CPU, memory, disk, network, users, services/processes.
2. Developer-environment inventory: OS facts plus runtimes, tools, SDKs, local/global npm packages.
3. Narrow OS-detection helpers: distro/libc identification that can supplement, not replace, broad inventory.
4. Dependency risk: release freshness, repository activity, platform support claims, scope mismatch.

Skill note: no skill-discovery tool was exposed in this sub-agent environment, so I applied package-evaluation / JavaScript dependency-risk criteria directly: maintenance recency, source diversity, stated platform matrix, API scope, and rejection of stale or too-narrow packages.

## Research

### Recommendation matrix

| Package | Recommendation | Platform scope | Facts covered | Missing / weak areas | Maintenance risk |
|---|---:|---|---|---|---|
| `systeminformation` | Primary choice | Linux, macOS, partial Windows, FreeBSD, OpenBSD, NetBSD, SunOS | platform, distro/release, kernel, arch, system/BIOS/baseboard, CPU, memory, disks/filesystems, network, users, processes, selected services, software versions, Docker | package inventory is not its core; some functions vary by OS and Windows support is called partial | Low: npm latest 5.31.11 modified 2026-06-25; GitHub pushed 2026-06-25 |
| `envinfo` | Secondary / complementary | Practical CLI/library for dev environments, commonly cross-platform | OS, CPU, memory, shell, binaries, package managers, SDKs, IDEs, languages, browsers, local/global npm packages | not hardware/deep system inventory; no disks/network/services/users | Low-medium: npm latest 7.21.0 modified 2025-11-27; GitHub pushed 2026-06-03 |
| `node-os-utils` | Monitoring add-on only | Linux, macOS, Windows | CPU usage/info, memory, disk, network, process, system overview; services limited by OS | no BSD; fewer inventory facts than `systeminformation`; major v2 rewrite/breaking changes | Medium: active 2026, but smaller project and new rewrite |
| `detect-libc` | Linux supplement | Linux libc detection; returns null/false on non-Linux | libc family/version, non-glibc Linux detection | intentionally not broad OS inventory | Low for its narrow role: npm latest 2.1.2 modified 2025-10-05; GitHub pushed 2025-10-05 |
| `getos` | Reject except legacy Linux distro fallback | Linux distribution detection | distro name/release | narrow, old; no broad inventory | High: npm modified 2022-06-18; GitHub pushed 2023-01-06 |
| `os-utils` | Reject | old OS utility library | basic CPU/memory/load helpers | stale, very limited, no broad inventory | High: npm modified 2022-06-23; GitHub pushed 2022-04-22 |

### Findings

1. **Use `systeminformation` as the broad OS/system inventory package.** Its README describes “50+ functions” for hardware, system, CPU, baseboard, battery, memory, disks/filesystem, network, Docker, software, services, and processes, and states support for Linux, macOS, partial Windows, FreeBSD, OpenBSD, NetBSD, and SunOS. Its support matrix includes `osInfo()` for OS/platform/release/arch/kernel/distro fields, `system()` / `bios()` / `baseboard()`, `cpu()`, `mem()`, `diskLayout()`, `fsSize()`, `networkInterfaces()`, `users()`, `processes()`, and `services()`. Contradiction/risk: the package says “partial Windows,” and support differs per function/OS, so callers must tolerate unavailable fields. Sources: npm registry/package metadata; GitHub repository metadata; official docs/site.

2. **Use `envinfo` only when the desired “facts” are developer-environment facts, especially package/tool versions.** Its README says it reports details needed for troubleshooting: OS, binary versions, browsers, installed languages, SDKs, IDEs, local `npmPackages`, and `npmGlobalPackages`. It covers OS/CPU/memory/shell, but not disk/network/users/services inventory. It is therefore complementary to `systeminformation`, not a replacement. Sources: npm registry/package metadata; GitHub repository metadata; README package documentation.

3. **Consider `node-os-utils` only for live monitoring metrics, not broad cross-platform inventory.** Version 2 claims Linux/macOS/Windows support and exposes CPU, memory, disk, network, process, and system monitors with structured errors. Its own platform matrix shows limitations: CPU temperature is partial, disk I/O stats are unavailable on Windows, system services are Linux partial / Windows supported / macOS unsupported, and Windows network/process metrics may need elevated PowerShell. It also excludes BSD/SunOS and has a v2 rewrite with breaking changes. Sources: npm registry/package metadata; GitHub repository metadata; README package documentation.

4. **Use `detect-libc` as a narrow Linux supplement where native binaries or packaging choices depend on glibc vs musl.** Its README states it detects C standard library family/version on Linux and returns `null` or `false` on non-Linux platforms. This is useful alongside `systeminformation.osInfo()` for Alpine/musl decisions, but it does not gather general inventory. Sources: npm registry/package metadata; GitHub repository metadata; README package documentation.

5. **Reject `getos` and `os-utils` for new broad inventory work.** `getos` exists to fill the old gap where Node’s `os.platform()` returns only `linux`, but it is Linux distro-only and has old release/activity metadata. `os-utils` is older, basic monitoring/utility scope and stale. Both fail the “broad cross-platform OS/system facts” requirement. Sources: npm registry/package metadata; GitHub repository metadata; package READMEs.

### Source notes

- https://www.npmjs.com/package/systeminformation — Access date: 2026-06-28. Source type: npm package page/registry metadata. Publisher: npm, Inc. Confidence: High. Relevant for version 5.31.11, description, license, maintainer, repository, modified date.
- https://github.com/sebhildebrandt/systeminformation — Access date: 2026-06-28. Source type: GitHub repository/README metadata. Publisher: GitHub / project maintainers. Confidence: High. Relevant for support claims, function list, repository activity.
- https://systeminformation.io — Access date: 2026-06-28. Source type: official documentation site. Publisher: systeminformation project. Confidence: High. Relevant for API documentation and support matrix.

- https://www.npmjs.com/package/envinfo — Access date: 2026-06-28. Source type: npm package page/registry metadata. Publisher: npm, Inc. Confidence: High. Relevant for version 7.21.0, description, modified date, repository.
- https://github.com/tabrindle/envinfo — Access date: 2026-06-28. Source type: GitHub repository/README metadata. Publisher: GitHub / project maintainers. Confidence: High. Relevant for feature categories and activity.
- https://github.com/tabrindle/envinfo#readme — Access date: 2026-06-28. Source type: README/package documentation. Publisher: project maintainers. Confidence: High. Relevant for CLI flags and reportable facts.

- https://www.npmjs.com/package/node-os-utils — Access date: 2026-06-28. Source type: npm package page/registry metadata. Publisher: npm, Inc. Confidence: High. Relevant for version 2.0.3, description, modified date.
- https://github.com/SunilWang/node-os-utils — Access date: 2026-06-28. Source type: GitHub repository/README metadata. Publisher: GitHub / project maintainer. Confidence: Medium-high. Relevant for v2 rewrite, platform matrix, API scope.
- https://github.com/SunilWang/node-os-utils#readme — Access date: 2026-06-28. Source type: README/package documentation. Publisher: project maintainer. Confidence: Medium-high. Relevant for supported monitor categories and limitations.

- https://www.npmjs.com/package/detect-libc — Access date: 2026-06-28. Source type: npm package page/registry metadata. Publisher: npm, Inc. Confidence: High. Relevant for version 2.1.2 and package scope.
- https://github.com/lovell/detect-libc — Access date: 2026-06-28. Source type: GitHub repository/README metadata. Publisher: GitHub / project maintainer. Confidence: High. Relevant for active repo and API behavior.
- https://github.com/lovell/detect-libc#readme — Access date: 2026-06-28. Source type: README/package documentation. Publisher: project maintainer. Confidence: High. Relevant for Linux-only/null-on-non-Linux behavior.

- https://www.npmjs.com/package/getos — Access date: 2026-06-28. Source type: npm package page/registry metadata. Publisher: npm, Inc. Confidence: High. Used for rejection due to narrow scope and old modified date.
- https://github.com/retrohacker/getos — Access date: 2026-06-28. Source type: GitHub repository/README metadata. Publisher: GitHub / project maintainers. Confidence: Medium. Used for rejection due to distro-only scope and low activity.
- https://www.npmjs.com/package/os-utils — Access date: 2026-06-28. Source type: npm package page/registry metadata. Publisher: npm, Inc. Confidence: High. Used for rejection due to stale limited package.
- https://github.com/oscmejia/os-utils — Access date: 2026-06-28. Source type: GitHub repository metadata. Publisher: GitHub / project maintainer. Confidence: Medium. Used for rejection due to low activity and limited scope.

## Verification

Commands/data checks performed on 2026-06-28:

- `npm view systeminformation name version description license time.modified repository.url homepage bugs.url maintainers dist-tags --json` → latest `5.31.11`, modified `2026-06-25`, MIT, official docs homepage.
- `npm view envinfo ... --json` → latest `7.21.0`, modified `2025-11-27`, MIT.
- `npm view node-os-utils ... --json` → latest `2.0.3`, modified `2026-04-07`, MIT.
- `npm view os-utils ... --json` → latest `0.0.14`, modified `2022-06-23`, MIT.
- `npm view getos ... --json` → latest `3.2.1`, modified `2022-06-18`, MIT.
- `npm view detect-libc ... --json` → latest `2.1.2`, modified `2025-10-05`, Apache-2.0.
- GitHub API repository metadata checked for pushed dates and archived status: `systeminformation` pushed `2026-06-25`; `envinfo` pushed `2026-06-03`; `node-os-utils` pushed `2026-04-07`; `detect-libc` pushed `2025-10-05`; `getos` pushed `2023-01-06`; `os-utils` pushed `2022-04-22`. None were archived.
- README text inspected through npm registry `readme` fields for declared features, supported OSes, and limitations.

## Insights

- Best lazy stack: start with `systeminformation`; add `envinfo` only if the product needs installed developer tools/npm package lists; add `detect-libc` only if Linux libc affects binary selection.
- Do not combine multiple monitoring packages just to gather facts. `node-os-utils` overlaps with the Node stdlib `os` module and `systeminformation` for many metrics, but with less OS breadth.
- Normalize results behind a thin internal adapter because every package has OS-dependent gaps. Avoid pretending the fact set is uniform across macOS/Linux/Windows/BSD.
- `systeminformation` uses OS commands/files under the hood, so inventory collection may be slower or permission-dependent for some facts. Cache snapshots if polling.
- For package inventory, `envinfo` is more direct than `systeminformation`, but its package reporting is mainly npm/dev-environment oriented, not OS package managers such as apt/rpm/Homebrew services inventory.

## Summary

Recommendation: use `systeminformation` as the primary npm package for broad cross-platform OS/system inventory facts. Add `envinfo` for developer-environment/package-version reports and `detect-libc` for Linux libc-specific decisions; reject `getos` and `os-utils` for broad inventory because they are narrow and stale. `node-os-utils` is acceptable for live monitoring on Linux/macOS/Windows, but not as the main inventory layer.
