# @boxfiles/provider-storage

Storage context provider placeholder for Boxfiles.

This package reserves the `storage` plugin capability for future workstation facts about disks, paths, mounts, and filesystem capacity.

Expected future facts may include home directory location, config directory conventions, mounted volumes, available space, and filesystem type.

## Status

No actions or context resolvers are implemented yet. The package currently registers an empty `storage` plugin so manifests and package boundaries can stabilize before implementation.
