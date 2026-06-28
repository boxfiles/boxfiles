# @boxfiles/provider-remove

Owns the `remove` action provider plan shape.

## Language

**Remove Action**:
A manifest step that declares deletion of a workstation path.
_Avoid_: cleanup task

**Recursive Remove**:
A remove action with `recursive: true`, meaning many paths may be deleted.
_Avoid_: directory sync

## Boundaries

- Planning exists; apply is intentionally not implemented yet.
- Remove actions are unsafe because they delete workstation state.
- `force: true` makes the planned action idempotent.
- This provider must not silently delete paths until execution safety policy exists.

## Flow

```text
remove step
  -> validate config
  -> plan delete operation
  -> apply returns not implemented
```
