# @boxfiles/provider-link

Symlink action provider for Boxfiles.

This package adds the `symlink` action kind. It validates link actions and contributes symbolic-link creation operations to the compiled plan.

## Action kind

```yaml
uses: symlink
with:
  from: ~/.config/example/source
  to: ~/.config/example/target
```

Use this provider when workstation setup should link an existing path instead of copying file contents.

## Status

Planning is implemented. Apply is intentionally stubbed until Boxfiles has a concrete execution safety policy.
