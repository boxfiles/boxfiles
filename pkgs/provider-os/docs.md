---
title: os
description: Built-in operating-system context plugin.
status: documented
category: reference
tags:
  - builtin-plugin
  - context
  - os
---

# `os`

Exposes read-only operating-system context facts. It has no actions and does not mutate workstation state.

## Facts

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

## Inspect facts

```sh
boxfiles context facts --prefix os.
boxfiles context facts --json --prefix os.
```

Prefix filters with no matches succeed. JSON output returns an empty object:

```json
{}
```

## Deferred scope

This provider does not include rich hardware inventory, package inventory, libc detection, WSL detection, container detection, CPU list facts, sensitive metadata, or actions.
