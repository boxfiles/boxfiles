# @boxfiles/provider-rename

Reserved package for future rename or move actions.

## Language

**Rename Provider**:
A built-in provider namespace for moving or renaming workstation paths.
_Avoid_: copy provider

## Boundaries

- Current plugin id is `rename`.
- No context facts or actions are exposed yet.
- Do not implement destructive move behavior without explicit safety semantics.

## Flow

```text
plugin load
  -> rename plugin registered
  -> no action providers yet
```
