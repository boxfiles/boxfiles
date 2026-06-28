# @boxfiles/provider-rename

Reserved package for future rename or move actions.

## Language

**Rename Provider**:
A built-in provider namespace for moving or renaming workstation paths.

**Rename Action**:
A manifest step that moves a workstation path from one path to another.
_Avoid_: move action, copy action, copy provider

## Boundaries

- Current plugin id is `rename`.
- No context facts or actions are exposed yet.
- Do not implement destructive move behavior without explicit safety semantics.
- `overwrite: true` marks the action unsafe because it may replace existing workstation state.
- `from` and `to` are workstation paths and must be absolute paths or `~` paths.

## Flow

```text
plugin load
  -> rename plugin registered
  -> no action providers yet
```
