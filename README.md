# boxfiles

## Installation

- releases tab
- download the latest release for your platform

```sh
mise use -g --pin github:zenobi-us/boxfiles
```

## Usage

```sh
## help
boxfiles --help

## apply changes idempotently to a module and all its children
boxfiles apply modulename
boxfiles apply modulename.childmodulename
boxfiles apply modulename.childmodulename.granchildmodulename

# start module tree at a specific path
boxfiles -d ./modulename/childmodulename apply granchildmodulename
BOXFILES_DIR=./modulename/childmodulename boxfiles apply granchildmodulename

## show manifests
boxfiles manifests
boxfiles manifests files # show uncompiled, unplanned manifest list from current directory
boxfiles manifests validate # show all manifest validation errors from current directory
boxfiles manifests plan # show planned manifest list from current directory

## show context
boxfiles context # show context from current directory

## plugins
boxfiles plugins # show all plugins
```

## Manifest file assets

A manifest may have a sibling `files/` directory for source assets. Copy actions resolve `from` relative to that directory, so manifest authors do not write `./files` in manifests.

Hidden `.boxfilesrc.{json,yaml,yml,toml}` files are config files, not manifests. Boxfiles ignores them during manifest discovery.

```text
modules/git.yaml
modules/files/gitconfig
```

```yaml
steps:
  - id: copy-gitconfig
    uses: copy
    with:
      from: gitconfig
      to: ~/.gitconfig
```

## Built-in providers

Boxfiles plugins are capability modules. Built-in providers live in:

```text
src/providers/{capability}.ts
```

Provider file basename should match plugin `id` for built-ins.

Current action providers:

- `copy`
- `remove`
- `link` TODO
- `rename` TODO
- `permissions` TODO
- `ownership` TODO

Current context providers:

- `user` TODO
- `os` TODO
- `packages` TODO
- `network` TODO
- `storage` TODO
- `gpu` TODO

## Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
