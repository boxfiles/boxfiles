---
title: Built-in plugins
description: Built-in Boxfiles plugins and provider status.
status: draft
category: reference
tags:
  - builtin-plugins
  - plugins
---

# Built-in plugins

Built-in plugins ship with Boxfiles. They are registered with source `builtin` and listed by:

```sh
boxfiles plugins list
```

## Plugin index

| Plugin | Source | Type | Provider kind | Status | Docs |
|---|---|---|---|---|---|
| `copy` | builtin | action | `copy` | planned, apply stubbed | [copy](./builtin-plugins/copy.md) |
| `remove` | builtin | action | `remove` | planned, apply stubbed | [remove](./builtin-plugins/remove.md) |
| `link` | builtin | action stub | none | undocumented | [link](./builtin-plugins/link.md) |
| `rename` | builtin | action stub | none | undocumented | [rename](./builtin-plugins/rename.md) |
| `permissions` | builtin | action stub | none | undocumented | [permissions](./builtin-plugins/permissions.md) |
| `ownership` | builtin | action stub | none | undocumented | [ownership](./builtin-plugins/ownership.md) |
| `user` | builtin | context stub | none | undocumented | [user](./builtin-plugins/user.md) |
| `os` | builtin | context stub | none | undocumented | [os](./builtin-plugins/os.md) |
| `packages` | builtin | context stub | none | undocumented | [packages](./builtin-plugins/packages.md) |
| `network` | builtin | context stub | none | undocumented | [network](./builtin-plugins/network.md) |
| `storage` | builtin | context stub | none | undocumented | [storage](./builtin-plugins/storage.md) |
| `gpu` | builtin | context stub | none | undocumented | [gpu](./builtin-plugins/gpu.md) |
