---
title: Plugins
description: Plugin architecture, authoring API, context facts, and action providers.
status: draft
category: architecture
tags:
  - plugins
  - architecture
---

# Plugins

## Purpose

Plugins extend Boxfiles with context facts and action providers.

Plugins are capability modules. They may expose:

- context facts gathered before planning
- action providers used during planning and apply

See [Plugin installer](./plugin-installer.md) for `.boxfilesrc` declarations, `plugin install`, cache behavior, removal, purge, and reproducibility warnings.

## Plugin lifecycle

```text
.boxfilesrc declaration
  -> plugin install validates source
  -> npm/git sources fetch into XDG cache
  -> file sources stay as local paths
  -> module import
  -> normalize plugin module
  -> validate plugin shape
  -> register plugin id
  -> register action providers
  -> gather context facts
  -> compile plan
  -> apply action plan
```

## Defining a plugin

Use `createPlugin()` from `src/services/Plugins.ts`.

```ts
export default createPlugin({
    id: "example",
    context: {
        "example.enabled": true,
    },
    actions: {
        example: exampleActionProvider,
    },
});
```

## Context facts

Context entries may be:

- static JSON-ish values
- resolver functions returning JSON-ish values

Resolvers receive:

- `rootDir`
- `pluginId`
- current fact snapshot

Rules:

- resolvers run during fact gathering
- resolvers must not mutate workstation state
- fact keys should be namespaced, for example `user.name` or `os.platform`
- collision default is `error`

## Action providers

Action providers define:

- `kind`
- TypeBox `schema`
- `validate(config)`
- `plan(input)`
- `apply(input)`

The provider schema is the single config type source. `validate()`, `plan()`, and `apply()` share the same config type through `ActionConfig<TConfigSchema>`.

Provider `plan()` and `apply()` receive `ctx.manifest` for the manifest currently being planned or executed:

```ts
ctx.manifest.id;
ctx.manifest.path;
ctx.manifest.dir;
ctx.manifest.filesDir;
```

Manifest paths are relative to `ctx.rootDir`. Providers should resolve absolute paths at the execution boundary.

## Registration constraints

Boxfiles rejects:

- duplicate plugin IDs
- duplicate action provider kinds
- invalid context objects
- invalid action provider shapes
- non-JSON context values

## Built-in provider conventions

Built-in providers live in:

```text
src/providers/{capability}.ts
```

Recommended conventions:

- provider filename matches plugin or capability id
- simple provider kind matches capability name

See [Built-in plugins](./builtin-plugins.md) for built-in provider behavior and current stub status.

## Current implementation

Core service: `src/services/Plugins.ts`

Key exported API:

- `createPlugin`
- `PluginService`
- `ActionProvider`
- `BoxfilePlugin`
- `ContextResolver`

## Open risks

`PluginService.evaluateContextEntry()` currently accepts raw context keys and maps them through `ContextService.factKey()`. Namespace enforcement is policy, not hard validation yet.
