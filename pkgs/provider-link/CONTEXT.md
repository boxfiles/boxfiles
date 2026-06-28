# @boxfiles/provider-link

Owns the `symlink` action provider.

## Language

**Symlink Action**:
A manifest step that creates a symbolic link from a manifest file asset to a workstation target path.
_Avoid_: shortcut, copy

**Link Target**:
The workstation path where the symbolic link is created.
_Avoid_: source

## Boundaries

- `from` is resolved under the owning manifest files directory during apply.
- `to` is the workstation link target and may expand `~`.
- Existing targets are treated as already satisfied.
- This provider creates links only; it does not remove or replace existing paths.

## Flow

```text
symlink step
  -> validate config
  -> plan create link target
  -> apply fs.symlink from manifest files directory to target
```
