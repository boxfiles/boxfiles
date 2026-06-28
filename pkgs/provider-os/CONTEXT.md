# @boxfiles/provider-os

Owns baseline operating-system context facts.

## Language

**OS Provider**:
A built-in provider that exposes `os.*` context facts and does not mutate workstation state.
_Avoid_: system inventory provider

**OS Context Fact**:
A namespaced context fact describing the workstation operating system.
_Avoid_: template variable

**Linux Distro Fact**:
An optional `os.distro.*` fact parsed from `/etc/os-release` on Linux.
_Avoid_: package manager fact

## Boundaries

- This provider exposes context only; it has no actions.
- Facts are omitted when unavailable; never emit `unknown` or `null` placeholders.
- Distro facts are Linux-only and best-effort.
- Keep facts baseline: no hardware inventory, package inventory, WSL, libc, or container detection here.

## Flow

```text
plugin context request
  -> createOsContext cached snapshot
  -> node:os baseline facts
  -> optional /etc/os-release distro facts
  -> ContextService stores os.* facts
```
