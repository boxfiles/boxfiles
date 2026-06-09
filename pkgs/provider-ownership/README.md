# @boxfiles/provider-ownership

Ownership action provider placeholder for Boxfiles.

This package reserves the `ownership` plugin capability for future file and directory owner/group changes.

Expected future actions may include changing owner, group, or both for a path, with safety metadata that marks privileged and recursive operations clearly in the plan.

## Status

No actions are implemented yet. The package currently registers an empty `ownership` plugin so manifests and package boundaries can stabilize before implementation.
