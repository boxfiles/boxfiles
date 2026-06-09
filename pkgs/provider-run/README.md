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

Planning is implemented. Apply is intentionally stubbed until Boxfiles has a concrete execution safety policy.
