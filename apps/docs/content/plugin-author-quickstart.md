---
title: Plugin author quickstart
description: Author a plugin with createPlugin() and use it in a manifest.
status: draft
category: tutorial
tags:
  - quickstart
  - tutorial
  - plugins
---

# Plugin author quickstart

## Goal

Create a plugin with `createPlugin()`, expose an action provider, then use it in a manifest.

## 1. Create a plugin

Plugins are authored with `createPlugin()`.
Create `src/providers/package.ts`:

```ts
import Type from "typebox";
import Schema from "typebox/schema";
import { createPlugin, type ActionProvider } from "@zenobius/boxfiles";

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

## 2. Use the plugin in a manifest

```yaml
steps:
  - id: install-git
    uses: package
    with:
      name: git
```

## 3. Add context-only plugins

Plugins can also expose facts without actions:
Create `src/providers/os.ts`:

```ts
import { createPlugin } from "@zenobius/boxfiles";

export default createPlugin({
    id: "os",
    context: {
        "os.platform": async () => process.platform,
        "os.arch": async () => process.arch,
    },
});
```

Context fact keys should be namespaced. Resolvers run during fact gathering and must not mutate workstation state.
