---
title: Plugin installer
description: Declare, install, remove, cache, and troubleshoot Boxfiles plugins.
status: draft
category: guide
tags:
  - plugins
  - installer
  - cache
---

# Plugin installer

## Purpose

Boxfiles plugins are declared in `.boxfilesrc` and loaded through the existing plugin capability system. The installer gives users one CLI workflow for recording plugin declarations and fetching remote plugin code into Boxfiles-owned cache storage.

Plugin installation stays inside the trusted-local-config boundary. It does not sandbox third-party code and does not make untrusted plugins safe.

## Declaration syntax

`.boxfilesrc` supports a `plugins` map. Keys are local plugin IDs. Values are source strings.

```json
{
  "plugins": {
    "hello": "npm:@acme/boxfiles-plugin-hello@1.2.3",
    "tools": "git:https://github.com/acme/boxfiles-tools.git#v0.4.0",
    "local-dev": "file:./plugins/local-dev"
  }
}
```

Supported source prefixes:

- `npm:` for npm packages, including scoped packages and optional version specs.
- `git:` for Git URLs with optional `#ref` fragments.
- `file:` for local plugin directories or files.

Source strings must be non-empty and contain no whitespace. Unsupported prefixes fail validation before install mutates config.

## Install plugins

Use `plugin install` from the workspace root:

```sh
boxfiles plugin install hello npm:@acme/boxfiles-plugin-hello@1.2.3
boxfiles plugin install tools git:https://github.com/acme/boxfiles-tools.git#v0.4.0
boxfiles plugin install local-dev file:./plugins/local-dev
```

For npm and git sources, install order is:

```text
validate source
  -> fetch into temp cache path
  -> commit artifact into XDG cache
  -> update .boxfilesrc
```

If source validation or fetch fails, `.boxfilesrc` stays unchanged. If config update fails after the cache artifact is committed, Boxfiles reports the cache path and repair/cleanup instructions.

For `file:` sources, Boxfiles validates the local path and updates `.boxfilesrc`. It does not copy, link, cache, or mutate the local source.

## Cache behavior

Remote plugin artifacts are stored under:

```text
$XDG_CACHE_HOME/boxfiles/plugins/{transport}/{name}__{hash}/
```

If `XDG_CACHE_HOME` is unset, Boxfiles falls back to the platform home cache directory, currently `~/.cache/boxfiles/plugins/` on Unix-like systems.

Cache transports are:

- `npm` for npm package sources.
- `git` for Git URL sources.

`file:` sources have no cache entry because they represent live local machine state.

Cache entry names include a readable source label plus a hash of the canonical source spec. This prevents path collisions between different npm versions, Git URLs, or refs.

## Remove and purge plugins

Remove a declaration without deleting cached files:

```sh
boxfiles plugin remove hello
```

Remove a declaration and purge its cache entry when safe:

```sh
boxfiles plugin remove hello --purge
```

Default removal edits only `.boxfilesrc` and keeps cache artifacts. Purge is explicit. Boxfiles skips cache deletion when another remaining declaration still references the same cache entry. `file:` sources never delete local files.

## List installed plugins

Inspect registered plugins and providers:

```sh
boxfiles plugins list
```

The list output includes plugin IDs, source labels, context fact keys, action provider kinds, and reproducibility warnings for configured plugin declarations.

## Reproducibility warnings

Until plugin lockfiles exist, Boxfiles labels plugin sources as unlocked or non-reproducible:

- npm without a version spec is floating.
- npm with a version spec is still not integrity-locked.
- git without a ref follows the remote default branch.
- git with a ref is still not commit/integrity-locked unless future lockfile support records that resolution.
- file sources are local machine state and not reproducible across workstations.

Warnings are visible but non-blocking under the current trusted-local-config policy.

Planning uses the cached artifact for npm and git plugins. Planning does not fetch live upstream code. File plugins are planned from the local path directly.

## Plugin author expectations

Installed plugin modules use the same capability contract as built-in plugins. A plugin may expose:

- action providers
- context fact providers
- both action and context capabilities

Context fact resolvers run during fact gathering, not template evaluation, and must not mutate workstation state. Fact keys should be namespaced, for example `user.name` or `os.platform`.

Action providers define a `kind`, TypeBox `schema`, `validate(config)`, `plan(input)`, and `apply(input)`. The schema is the single config type source shared by validation, planning, and apply.

See [Plugin author quickstart](./plugin-author-quickstart.md) for a minimal plugin module example.

## Deferred work

Lockfile support is deferred. Trust prompts, sandboxing, remote fleet policy, and GUI plugin management are also deferred. Do not treat installed third-party plugin code as isolated or safe.
