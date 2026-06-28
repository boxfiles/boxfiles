# @boxfiles/provider-permissions

Reserved package for future permission-changing actions.

## Language

**Permissions Provider**:
A built-in provider namespace for file mode or permission changes.
_Avoid_: ownership provider

## Boundaries

- Current plugin id is `permissions`.
- No context facts or actions are exposed yet.
- Do not add speculative chmod/chattr behavior without an execution safety policy.

## Flow

```text
plugin load
  -> permissions plugin registered
  -> no action providers yet
```
