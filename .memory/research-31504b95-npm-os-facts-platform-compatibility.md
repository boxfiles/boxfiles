# Research: npm OS fact packages — platform compatibility

## Thinking
Search facets used:
1. Baseline Node APIs for cross-platform OS facts (`node:os`, `process.platform`).
2. Broad npm packages that gather system/OS facts across platforms.
3. Narrow npm packages that name OS releases or Linux distributions.
4. Dependency/runtime risk signals from npm registry metadata and package docs.

Scope: compare macOS/darwin, Linux, Windows, and FreeBSD/OpenBSD/NetBSD where claims or behavior are documented. Access date for all cited URLs: 2026-06-28.

## Research
| Package | macOS/darwin | Linux | Windows | BSD status | Notes / risk | Key sources |
|---|---:|---:|---:|---|---|---|
| `node:os` built-in | Yes | Yes | Yes | **Partial / platform-level**: `os.platform()` can return `freebsd` and `openbsd`; docs list no `netbsd` in the cited `os.platform()` return set. | Best baseline: no dependency, stable generic facts (`platform`, `type`, `release`, `version`, CPU/mem/network). Not a distro/release-name library. | Node docs say `os.platform()` returns values including `darwin`, `freebsd`, `linux`, `openbsd`, `sunos`, `win32`; `os.release()` uses `uname(3)` on POSIX and Windows version APIs. Source type: official docs; publisher: OpenJS/Node.js; confidence: high. https://nodejs.org/api/os.html |
| `systeminformation` | Claimed | Claimed | Claimed **partial** | **First-class claimed, but feature coverage varies**: package metadata includes `freebsd`, `openbsd`, `netbsd`; README says supports FreeBSD/OpenBSD/NetBSD. | Strongest npm candidate for broad facts. No npm deps. But docs explicitly say Windows is partial; expect per-field differences by OS. | README: “supports Linux, macOS, partial Windows, FreeBSD, OpenBSD, NetBSD, SunOS and Android support.” Package `os` metadata includes `darwin`, `linux`, `win32`, `freebsd`, `openbsd`, `netbsd`, `sunos`, `android`. Source type: GitHub README + npm registry metadata; publisher: Sebastian Hildebrandt/npm; confidence: high for claims, medium for every individual fact. https://raw.githubusercontent.com/sebhildebrandt/systeminformation/master/README.md and https://registry.npmjs.org/systeminformation/latest |
| `os-name` | Claimed, via `macos-release` | Claimed, reads `/etc/os-release` | Claimed, via `windows-release` | **Partial / unclaimed**: implementation returns the raw platform string for `freebsd`, `openbsd`, `netbsd`; docs do not claim BSD naming. | Good small package for display names on macOS/Linux/Windows. Not enough for detailed facts. Requires Node >=20. | README shows examples for macOS, Ubuntu/Linux, Windows and says Linux reads `/etc/os-release`. Source code falls through to `return platform` for other platforms. Source type: GitHub README/source + npm registry metadata; publisher: Sindre Sorhus/npm; confidence: high. https://raw.githubusercontent.com/sindresorhus/os-name/main/readme.md and https://raw.githubusercontent.com/sindresorhus/os-name/main/index.js and https://registry.npmjs.org/os-name/latest |
| `envinfo` | Demonstrated in docs | Generic/system report | Generic/system report | **Unclaimed**: no explicit FreeBSD/OpenBSD/NetBSD support claim found. | Useful CLI/report generator for issue templates, not a focused OS facts API. Runtime claims are broad but examples are macOS-heavy. | README says it reports OS, CPU, memory, shell, binaries, browsers, etc.; example output is macOS. Registry has no `os` restriction and no deps in latest metadata. Source type: GitHub README + npm registry metadata; publisher: envinfo maintainers/npm; confidence: medium. https://raw.githubusercontent.com/tabrindle/envinfo/main/README.md and https://registry.npmjs.org/envinfo/latest |
| `linux-os-info` | Generic fallback only | Claimed first-class for Linux release files | Generic fallback only | **Unclaimed / generic fallback likely**: docs only promise Node `os` info when Linux release files are absent; no BSD examples. | Lightweight and dependency-free, but Linux-centered by design. Good if Linux distro details are the only extra needed. | README says it reads `/etc/os-release`, `/usr/lib/os-release`, or `/etc/alpine-release` for Linux; otherwise returns only Node `os` module info. It includes sample Windows and macOS outputs with only generic fields. Source type: GitHub README + npm registry metadata; publisher: bmacnaughton/npm; confidence: high. https://raw.githubusercontent.com/bmacnaughton/linux-os-info/master/README.md and https://registry.npmjs.org/linux-os-info/latest |
| `getos` | Not claimed | Claimed Linux distro detection | Not claimed | **Unsupported / unclaimed**. | Old Linux-distribution detector; uses distro resource files and asks users to submit untested distros. Avoid for cross-platform facts. | README problem statement: `os.platform()` returns `linux`, package solves distro name; examples are Linux only; disclaimer centers Linux distro resource files. Source type: GitHub README + npm registry metadata; publisher: retrohacker/npm; confidence: high. https://raw.githubusercontent.com/retrohacker/getos/master/README.md and https://registry.npmjs.org/getos/latest |

## Verification
Local smoke test on Linux/Bazzite with Node showed:
- `node:os` returned platform `linux`, type `Linux`, kernel release, and OS version.
- `systeminformation.osInfo()` returned `platform: linux`, distro `Bazzite`, release, codename, arch.
- `os-name` custom-platform test returned named values for `darwin`, `linux`, `win32`; for `freebsd`, `openbsd`, `netbsd` it returned the raw platform string.
- `linux-os-info` read `/etc/os-release` and returned Linux distro details.
- `envinfo` produced a System OS line with Linux kernel + Bazzite release.
- `getos` returned Fedora-family distro data on Bazzite.

These checks verify Linux behavior only; BSD and Windows/macOS conclusions are from docs/source claims above.

## Insights
1. Use `node:os` as the floor everywhere. It is the only zero-dependency option and covers generic facts across macOS/Linux/Windows and at least FreeBSD/OpenBSD platform identifiers, but it will not tell you “Ubuntu”, “Windows 11”, or “macOS Sequoia” by itself.
2. If one npm package must cover the parent topic broadly, `systeminformation` is the only researched package with explicit macOS, Linux, Windows, FreeBSD, OpenBSD, and NetBSD claims. Treat BSD support as claimed but still test the specific facts you need because cross-platform field parity is not guaranteed.
3. `os-name` is fine for a user-facing OS label on macOS/Linux/Windows, but BSD is only a fallback string, not first-class naming.
4. `linux-os-info` and `getos` are Linux-specific helpers; they should not be selected for “regardless of mac/linux/windows/bsd” unless wrapped behind `node:os` fallback logic.
5. `envinfo` is better as a diagnostic report CLI/library than a normalized OS facts dependency.

## Summary
Recommended lazy stack: start with `node:os`; add `systeminformation` only when you need richer normalized facts beyond the built-in. For display names on macOS/Linux/Windows, `os-name` is smaller, but it does not provide first-class BSD names. BSD-compatible requirements should be validated against real FreeBSD/OpenBSD/NetBSD CI or VMs before committing to any npm package claim.
