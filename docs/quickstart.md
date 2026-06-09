---
title: Quickstart
description: Create a workspace, write a manifest, and author a plugin.
status: draft
category: tutorial
tags:
  - quickstart
  - tutorial
---

# Quickstart

## Goal

Create a small Boxfiles workspace, run the `boxfiles` binary, then add a plugin using the public `createPlugin()` API from `@zenobius/boxfiles`.

## 1. Create a workspace

```sh
mkdir workstation
cd workstation
mkdir -p modules/files plugins
```

## 2. Create a manifest

Boxfiles discovers `.yaml`, `.yml`, and `.toml` manifests below the selected root. Put manifests in manifest directories. Copy sources come from a `files/` directory next to the current manifest, so manifest authors reference `gitconfig`, not `./files/gitconfig`.


Hidden `.boxfilesrc.{json,yaml,yml,toml}` files are config files, not manifests. Boxfiles ignores them anywhere in the tree.

Create `modules/git.yaml`:

```yaml
steps:
  - id: copy-gitconfig
    uses: copy
    with:
      from: gitconfig
      to: ~/.gitconfig
      overwrite: false
```

Create the source file:

```sh
printf '[user]\n    name = Example\n' > modules/files/gitconfig
```

See [`copy` built-in plugin docs](./builtin-plugins/copy.md) for source path rules and planning behavior.

## 3. Inspect discovered manifests

Run Boxfiles from the workspace root:

```sh
boxfiles manifests files
```

Expected output shape:

```markdown
## Discovered Manifests

- [modules.git](modules/git.yaml)
```

Use `--dir` when running from another directory:

```sh
boxfiles manifests files --dir ./workstation
```

## 4. Create a plugin

Plugins are authored with `createPlugin()` from `@zenobius/boxfiles`.

Create `plugins/package.ts`:

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

    async plan({ action }) {
        return {
            actionId: action.id,
            manifestId: action.manifestId,
            kind: action.uses,
            summary: `Install package ${action.config.name}`,
            safety: {
                idempotent: true,
                unsafe: false,
                reason: undefined,
            },
            changes: [
                {
                    target: action.config.name,
                    operation: "execute",
                    before: undefined,
                    after: { package: action.config.name },
                    message: "install package",
                },
            ],
        };
    },

    async apply({ action }) {
        return {
            actionId: action.id,
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

## 5. Use the plugin in a manifest

Create `modules/packages.yaml`:

```yaml
steps:
  - id: install-git
    uses: package
    with:
      name: git
```

## 6. Reference manifest dependencies

Manifest IDs are derived from manifest paths relative to the selected root. The extension is removed and path separators become dots.

```text
base/foundation.toml -> base.foundation
demo/base/foundation.toml -> demo.base.foundation
```

`dependsOn` accepts full manifest IDs or shorter IDs that resolve through enclosing namespaces.

```yaml
dependsOn:
  - base.foundation
```

Dependency resolution succeeds only when the dependency token maps to one unique manifest. If multiple unique manifests match, Boxfiles fails and requires the full manifest ID.

## 7. Add context-only plugins

Plugins can also expose facts without actions:

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

## 8. Use manifest context in providers

Action providers receive the manifest being planned or executed through `ctx.manifest`:

```ts
async plan({ action, ctx }) {
    return {
        actionId: action.id,
        manifestId: ctx.manifest.id,
        kind: action.uses,
        summary: `Plan ${ctx.manifest.path}`,
        safety: {
            idempotent: true,
            unsafe: false,
            reason: undefined,
        },
        changes: [
            {
                target: ctx.manifest.filesDir,
                operation: "noop",
                before: undefined,
                after: undefined,
                message: "manifest-local files directory",
            },
        ],
    };
}
```

`ctx.manifest.filesDir` is relative to `ctx.rootDir`.

## 9. Plan or apply

Compile a manifest plan:

```sh
boxfiles manifests plan
```

Apply a manifest when ready:

```sh
boxfiles apply modules.git
```