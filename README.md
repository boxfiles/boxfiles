# boxfiles

Bun + TypeScript CLI for workstation provisioning.

## Install

```bash
bun install
```

## Run

```bash
moon run cli:start
```

## Dev

```bash
moon run repo:typecheck
moon run repo:build
```

## Usage

```bash
boxfiles --help
boxfiles apply modulename
boxfiles manifests
boxfiles plugins
```

## Manifest file assets

A manifest may have a sibling `files/` directory for source assets. Copy actions resolve `from` relative to that directory.

Hidden `.boxfilesrc.{json,yaml,yml,toml}` files are config files, not manifests. Boxfiles ignores them during manifest discovery.

## Built-in providers

Built-ins live at `pkgs/provider-{capability}/src/index.ts`.

## Release

GitHub Releases are built from `apps/cli` publish task.
