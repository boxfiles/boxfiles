---
title: rename
description: Built-in rename action plugin.
status: active
category: reference
tags:
  - builtin-plugin
  - action
  - rename
---

# `rename`

Moves a workstation path from `from` to `to`.

```yaml
steps:
  - uses: rename
    with:
      from: ~/.config/app/source.txt
      to: ~/.config/app/target.txt
```
