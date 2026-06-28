# @boxfiles/provider-copy

Owns the `copy` action provider.

## Language

**Copy Action**:
A manifest step that copies a file or directory from the manifest `files` directory to a workstation target path.
_Avoid_: sync, template install

**Manifest Files Directory**:
The `files` directory next to the manifest that owns the step.
_Avoid_: repo assets

## Boundaries

- `from` is relative to the owning manifest files directory.
- `from` must not be absolute, start with `files/`, or use parent traversal.
- `to` is the workstation target path and may expand `~`.
- `overwrite: true` marks the action unsafe because it can replace existing state.

## Flow

```text
copy step
  -> validate config
  -> plan create/update target
  -> apply fs.cp from manifest files directory to target
```
