# @boxfiles/diagnostics

Owns user-facing diagnostic formatting.

## Language

**Command Error**:
An error rendered for CLI output.
_Avoid_: exception type

**Validation Error Report**:
Markdown-formatted TypeBox validation details.
_Avoid_: stack trace

**Plugin Reproducibility Warning**:
A warning that a plugin source is floating, local, or otherwise not reproducible.
_Avoid_: install error

## Boundaries

- This package formats errors and warnings for display.
- This package must not decide whether an operation succeeds.
- This package must not mutate config, plugins, manifests, facts, or plans.

## Flow

```text
error/warning object
  -> diagnostics formatter
  -> markdown/plain CLI output
```
