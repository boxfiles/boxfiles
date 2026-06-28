# @boxfiles/provider-rename

Provides the built-in `rename` action for moving or renaming workstation paths.

## Language

**Rename Provider**:
A built-in provider namespace for moving or renaming workstation paths.

**Rename Action**:
A manifest step that moves a workstation path from one path to another.
_Avoid_: move action, copy action, copy provider

## Boundaries

- Current plugin id is `rename`.
- Exposes the `rename` action provider.
- Do not implement destructive move behavior without explicit safety semantics.
- `overwrite: true` marks the action unsafe because it may replace existing workstation state.
- `from` and `to` are workstation paths and must be absolute paths or `~` paths.

## Flow

```text
plugin load
  -> rename plugin registered
  -> rename action provider registered
  -> apply moves from path to target path
```
