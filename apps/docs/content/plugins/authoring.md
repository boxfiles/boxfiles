---
title: Authoring
description: Plugin architecture, authoring API, context facts, and action providers.
status: draft
category: architecture
tags:
  - plugins
  - architecture
---

Plugins extend Boxfiles with context facts and action providers.

Plugins are capability modules. They may expose:

- context facts gathered before planning
- action providers used during planning and apply

See [Plugin installer](../plugin-installer.md) for `.boxfilesrc` declarations, `plugin install`, cache behavior, removal, purge, and reproducibility warnings.

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

See [Built-in plugins](/builtin) for built-in provider behavior and current stub status.

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

## Plugin author quickstart

### Goal

Create a plugin with `createPlugin()`, expose an action provider, then use it in a manifest.

### 1. Create a plugin

Plugins are authored with `createPlugin()`.
Create `src/providers/package.ts`:

```ts
import Type from "typebox";
import Schema from "typebox/schema";
import { createPlugin, type ActionProvider } from "@boxfiles/cli";

const PackageConfigSchema = Type.Object({
    name: Type.Readonly(Type.String({ minLength: 1 })),
});

const PackageConfigParser = Schema.Compile(PackageConfigSchema);

const packageProvider: ActionProvider<typeof PackageConfigSchema> = {
    kind: "package",
    schema: PackageConfigSchema,

    validate(config) {
        if (!PackageConfigParser.Check(config)) {
            return {
                success: false,
                errors: ["Invalid package action config"],
            };
        }

        return {
            success: true,
            value: PackageConfigParser.Parse(config),
        };
    },

    async plan(input) {
        return {
            actionId: input.action.id,
            manifestId: input.action.manifestId,
            kind: input.action.uses,
            summary: `Install package ${input.action.config.name}`,
            safety: {
                idempotent: true,
                unsafe: false,
                reason: undefined,
            },
            changes: [
                {
                    target: input.action.config.name,
                    operation: "create",
                    before: undefined,
                    after: {
                        package: input.action.config.name,
                    },
                    message: "install package",
                },
            ],
        };
    },

    async apply(input) {
        return {
            actionId: input.action.id,
            success: false,
            message: "package apply is not implemented yet",
        };
    },
};

export default createPlugin({
    id: "package",
    context: {
        "package.manager": "unknown",
    },
    actions: {
        package: packageProvider,
    },
});
```

See [`src/providers/copy.ts`](../src/providers/copy.ts) for a full provider example in this repo.

### 2. Use the plugin in a manifest

```yaml
steps:
  - id: install-git
    uses: package
    with:
      name: git
```

### 3. Add context-only plugins

Plugins can also expose facts without actions:
Create `src/providers/os.ts`:

```ts
import { createPlugin } from "@boxfiles/cli";

export default createPlugin({
    id: "os",
    context: {
        "os.platform": async () => process.platform,
        "os.arch": async () => process.arch,
    },
});
```

Context fact keys should be namespaced. Resolvers run during fact gathering and must not mutate workstation state.
