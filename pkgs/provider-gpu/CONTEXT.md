# @boxfiles/provider-gpu

Reserved package for future GPU context facts.

## Language

**GPU Provider**:
A built-in provider namespace for graphics hardware facts.
_Avoid_: OS provider

## Boundaries

- Current plugin id is `gpu`.
- Current context is empty.
- No actions are exposed yet.
- Keep future facts detection-only unless a separate action provider is explicitly designed.

## Flow

```text
plugin load
  -> gpu plugin registered
  -> empty context
```
