---
title: remove
description: Plan removal of files or directories from workstation state.
status: draft
category: reference
tags:
  - builtin-plugin
  - action
  - remove
---

# `remove`

> [!WARNING]
> `remove` planning exists. Apply behavior is currently stubbed and does not mutate workstation state yet.

## Purpose

Plan removal of a file or directory from the workstation.

## Manifest syntax

```yaml
steps:
  - id: remove-cache
    uses: remove
    with:
      path: ~/.cache/example
      recursive: true
      force: false
```

## Config

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `path` | string | yes | Workstation path to remove. |
| `recursive` | boolean | no | Indicates recursive removal. |
| `force` | boolean | no | Marks missing target tolerance/idempotency. |

## Planning behavior

`remove` emits one planned change:

- `operation: delete`
- `target: with.path`
- message is `remove recursively` when `recursive: true`, otherwise `remove path`

Safety:

- `unsafe: true`
- `idempotent: true` only when `force: true`
- recursive removals explain risk as `recursive remove may delete many files`
- non-recursive removals explain risk as `remove deletes workstation state`
