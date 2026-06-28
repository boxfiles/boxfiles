# @boxfiles/provider-rename

Provides the built-in `rename` action for moving or renaming workstation paths.

## Language

**Rename Provider**:
A built-in provider namespace for moving or renaming workstation paths.
_Avoid_: copy provider

## Boundaries

- Current plugin id is `rename`.
- Exposes the `rename` action provider.
- Do not implement destructive move behavior without explicit safety semantics.

## Flow

```text
plugin load
  -> rename plugin registered
  -> rename action provider registered
  -> apply moves from path to target path
```
