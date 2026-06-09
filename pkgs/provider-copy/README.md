# @boxfiles/provider-copy

Copy action provider for Boxfiles.

This package adds the `copy` action kind. It validates copy actions, resolves manifest-relative source paths, and contributes copy operations to the compiled plan.

## Action kind

```yaml
uses: copy
with:
  from: dotfiles/gitconfig
  to: ~/.gitconfig
  overwrite: false
```

`from` is relative to the manifest `files` directory. Absolute paths, parent traversal, and a leading `files/` prefix are rejected to keep manifests portable.

## Status

Planning is implemented. Apply is intentionally stubbed until Boxfiles has a concrete execution safety policy.
