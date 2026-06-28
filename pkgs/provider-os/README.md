# @boxfiles/provider-os

Read-only operating system Context Facts for Boxfiles.

The package exports the default `os` Provider. It exposes flat `os.*` facts and no actions.

## Emitted facts

Generic facts, emitted when the runtime API returns a value:

- `os.platform`
- `os.type`
- `os.release`
- `os.version`
- `os.arch`
- `os.machine`
- `os.hostname`
- `os.tmpdir`
- `os.memory.total` — bytes
- `os.memory.free` — bytes

Linux distro facts, emitted when `/etc/os-release` is readable and contains the value:

- `os.distro.id`
- `os.distro.versionId`
- `os.distro.prettyName`
- `os.distro.idLike` — string array

Unavailable facts are omitted. The provider does not emit `unknown`, `null`, or placeholder values.

## Deferred scope

No rich hardware inventory, package inventory, libc detection, WSL detection, container detection, CPU list facts, sensitive metadata model changes, or actions are included in this slice.
