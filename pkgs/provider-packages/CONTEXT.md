# @boxfiles/provider-packages

Reserved package for future package manager context facts or package actions.

## Language

**Packages Provider**:
A built-in provider namespace for package manager facts or package installation planning.
_Avoid_: plugin installer

## Boundaries

- Current plugin id is `packages`.
- Current context is empty.
- No actions are exposed yet.
- Do not mix Boxfiles plugin installation with workstation package management.

## Flow

```text
plugin load
  -> packages plugin registered
  -> empty context
```
