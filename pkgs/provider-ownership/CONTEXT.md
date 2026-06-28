# @boxfiles/provider-ownership

Reserved package for future ownership-changing actions.

## Language

**Ownership Provider**:
A built-in provider namespace for file owner/group changes.
_Avoid_: permissions provider

## Boundaries

- Current plugin id is `ownership`.
- No context facts or actions are exposed yet.
- Do not add chown behavior without explicit privilege and safety semantics.

## Flow

```text
plugin load
  -> ownership plugin registered
  -> no action providers yet
```
