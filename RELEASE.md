# Release Process

Boxfiles uses Release Please for versioning and release notes.

## Flow

1. Merge changes to `main`.
2. Release Please opens or updates the release PR.
3. Merge the release PR.
4. GitHub publishes the release.
5. The publish workflow builds the binaries and uploads them to the release.

## Manual release

You can also trigger the publish workflow manually from GitHub Actions and provide a release tag.

## Notes

- Commits should follow Conventional Commits.
- Release tags use the `v` prefix.
- Binaries are built with `mise run build`.
