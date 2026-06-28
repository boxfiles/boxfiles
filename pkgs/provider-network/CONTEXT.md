# @boxfiles/provider-network

Reserved package for future network context facts or actions.

## Language

**Network Provider**:
A built-in provider namespace for network-related workstation information.
_Avoid_: OS provider

## Boundaries

- Current plugin id is `network`.
- Current context is empty.
- No actions are exposed yet.
- Do not add network mutation without explicit dry-run and safety semantics.

## Flow

```text
plugin load
  -> network plugin registered
  -> empty context
```
