# @boxfiles/provider-run

Shell command action provider for Boxfiles.

This package adds the `run` action kind. It validates command strings and contributes command execution steps to the compiled plan.

## Action kind

```yaml
uses: run
with:
  command: mise install
```

Run actions are always marked unsafe and non-idempotent because arbitrary shell commands can mutate workstation state in ways Boxfiles cannot inspect.

## Status

Planning and apply are implemented. Apply runs shell commands only when execution is confirmed, reports non-zero exits, and skips commands when an optional `check` succeeds.
