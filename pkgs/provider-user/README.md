# @boxfiles/provider-user

User context provider placeholder for Boxfiles.

This package reserves the `user` plugin capability for future facts about the current workstation user.

Expected future facts may include username, home directory, shell, UID/GID where available, and user-specific config paths.

## Status

No actions or context resolvers are implemented yet. The package currently registers an empty `user` plugin so manifests and package boundaries can stabilize before implementation.
