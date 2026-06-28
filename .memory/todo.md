# TODO

## provider-os deferred scope

- [ ] Add `systeminformation` only if provider-os grows into rich hardware/network/storage/service inventory.
- [ ] Add `detect-libc` only if manifest planning needs exact `os.libc.family` or `os.libc.version`.
- [ ] Add WSL facts only if manifests need WSL-specific branching.
- [ ] Add container facts only if manifests need container-specific branching.
- [ ] Add sensitive context metadata support before relying on fact redaction for `os.user.*` or path facts.
- [ ] Add CPU list facts only if manifests need hardware-capacity branching.
