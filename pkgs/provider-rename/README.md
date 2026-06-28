# @boxfiles/provider-rename

Rename action provider for Boxfiles.

Provides the built-in `rename` action for moving one workstation path from `from` to `to`.

```yaml
steps:
  - uses: rename
    with:
      from: ~/.config/app/source.txt
      to: ~/.config/app/target.txt
```
