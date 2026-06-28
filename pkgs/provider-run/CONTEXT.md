# @boxfiles/provider-run

Owns the `run` action provider for shell commands.

## Language

**Run Action**:
A manifest step that executes a shell command through `just-bash`.
_Avoid_: script provider

**Check Command**:
An optional command that makes the run action idempotent when it exits successfully.
_Avoid_: preflight validation

## Boundaries

- `command` is arbitrary workstation mutation and is always unsafe.
- `check` is optional; a successful check skips `command`.
- Commands run with a filesystem rooted at the plan root directory.
- This provider does not parse shell syntax or infer command effects.

## Flow

```text
run step
  -> validate command/check
  -> plan execute operation
  -> apply check if present
  -> apply command if needed
```
