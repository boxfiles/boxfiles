# Research: npm OS fact gathering fit for Boxfiles provider-os

## Thinking
Question split into facets: (1) Node/Bun built-ins for cross-platform OS facts; (2) Linux-only gaps such as distro, libc, WSL, container; (3) npm package candidates and dependency cost; (4) Boxfiles fit as a Bun + TypeScript read-only fact provider. Skills considered: CLI tooling, dotfile provisioning, dependency management. Ponytail/default constraint: use stdlib/native first, add packages only for a proven gap.

## Research
1. **Core OS facts do not need npm.** `node:os` is stable and covers `arch`, `cpus`, `freemem`, `homedir`, `hostname`, `machine`, `platform`, `release`, `tmpdir`, `totalmem`, `type`, `userInfo`, and `version`; `os.platform()` and `os.arch()` are equivalent to `process.platform` and `process.arch`. That maps directly to namespaced facts like `os.platform`, `os.release`, `os.arch`, `os.hostname`, `os.homedir`, `os.tmpdir`, `os.user`, `os.cpu`, and `os.memory`. Source: https://nodejs.org/api/os.html, accessed 2026-06-28, official docs, Node.js, high confidence.

2. **Bun supports the Node `os` module path needed here.** Bun publishes a Node.js `os` module API reference, so Boxfiles can keep provider-os Bun-native without introducing a portability package. Source: https://bun.com/reference/node/os, accessed 2026-06-28, official docs, Bun, high confidence.

3. **Linux distro facts are better gathered by parsing `/etc/os-release` than by adding npm.** The Linux `os-release(5)` interface is the standard place for OS identification fields such as `ID`, `ID_LIKE`, `VERSION_ID`, `PRETTY_NAME`, and related metadata. A tiny parser is enough and keeps the provider read-only. Source: https://man7.org/linux/man-pages/man5/os-release.5.html, accessed 2026-06-28, manual page, Linux man-pages project, high confidence.

4. **`detect-libc` is the only narrowly-scoped package worth keeping on an optional path.** It detects libc family/version on Linux and supports glibc and musl; current npm metadata shows version 2.1.2, no listed runtime dependencies, and ~26 KB unpacked. Use it only if provisioning rules need exact `os.libc.family` / `os.libc.version` beyond what native probes can provide. Sources: https://github.com/lovell/detect-libc, accessed 2026-06-28, package README, lovell, high confidence; npm registry metadata via `npm view detect-libc`, accessed 2026-06-28, package metadata, npm, high confidence.

5. **Broad inventory libraries are overkill for provider-os.** `systeminformation` covers OS info plus CPU, baseboard, battery, graphics, Docker, services, users, versions, and many more APIs; npm metadata shows ~846 KB unpacked. That is useful for a hardware inventory app, not for a provisioning context provider that only needs small read-only OS facts. Sources: https://github.com/sebhildebrandt/systeminformation, accessed 2026-06-28, package README, seb hildebrandt/systeminformation, high confidence; npm registry metadata via `npm view systeminformation`, accessed 2026-06-28, package metadata, npm, high confidence.

6. **WSL/container packages are small but still optional.** `is-wsl` targets WSL 1 and 2 but depends on `is-inside-container`; `is-inside-container` checks container status and depends on `is-docker`. Native read-only probes (`/proc/version`, `/proc/sys/kernel/osrelease`, `WSL_INTEROP`, `/.dockerenv`, `/run/.containerenv`, `/proc/1/cgroup`) are enough for initial facts such as `os.wsl` and `os.container`, with package upgrade only if false positives matter. Sources: https://github.com/sindresorhus/is-wsl, accessed 2026-06-28, package README, Sindre Sorhus, medium-high confidence; https://github.com/sindresorhus/is-inside-container, accessed 2026-06-28, package README, Sindre Sorhus, medium-high confidence; npm registry metadata via `npm view is-wsl is-inside-container`, accessed 2026-06-28, package metadata, npm, high confidence.

7. **`os-name` is not needed for provisioning facts.** Its README says it is useful for analytics/debugging and it produces a human-friendly OS name; npm metadata shows dependencies on `macos-release` and `windows-release`. Boxfiles should prefer machine facts (`os.platform`, `os.distro.id`, `os.release`) over display labels. Sources: https://github.com/sindresorhus/os-name, accessed 2026-06-28, package README, Sindre Sorhus, high confidence; npm registry metadata via `npm view os-name`, accessed 2026-06-28, package metadata, npm, high confidence.

## Verification
- Checked current repo dependencies: `@boxfiles/provider-os` currently depends only on workspace packages and `typebox`; adding an npm OS library would be a new runtime dependency.
- Verified Node docs for exact built-in coverage and `process.platform`/`process.arch` equivalence.
- Verified Bun official `node:os` reference is available.
- Verified package metadata with `npm view`: `detect-libc@2.1.2` has no listed deps and ~26 KB unpacked; `systeminformation@5.31.11` is ~846 KB unpacked; `is-wsl@3.1.1` depends on `is-inside-container`; `is-inside-container@1.0.0` depends on `is-docker`; `os-name@7.0.0` depends on `macos-release` and `windows-release`.

## Insights
- Recommended default: **no npm package**. Implement provider-os with `node:os`, `process.platform`, `process.arch`, and small read-only Linux file probes.
- Minimal fact set: `os.platform`, `os.type`, `os.release`, `os.version`, `os.arch`, `os.machine`, `os.hostname`, `os.homedir`, `os.tmpdir`, `os.userInfo`, `os.cpus`, `os.memory.total`, `os.memory.free`, plus Linux-only `os.distro.*` from `/etc/os-release`.
- Optional upgrade path: add `detect-libc` only when exact libc facts become required for package selection; add `is-wsl`/`is-inside-container` only if native WSL/container heuristics become demonstrably unreliable.
- Avoid: `systeminformation` and `os-name` for provider-os initial scope.

## Summary
Best package choice for Boxfiles provider-os is **no package** for the initial implementation. Built-ins and standard OS files cover the provisioning facts with less risk and no dependency cost; keep `detect-libc` as the only narrow optional package if exact Linux libc detection becomes a real requirement.
