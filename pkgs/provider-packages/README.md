# @boxfiles/provider-packages

Package manager provider placeholder for Boxfiles.

This package reserves the `packages` plugin capability for future package-manager facts and actions.

Expected future support may include package install planning for Homebrew, apt, dnf, pacman, winget, or other platform-specific package managers.

## Status

No actions or context resolvers are implemented yet. The package currently registers an empty `packages` plugin so manifests and package boundaries can stabilize before implementation.
