---
title: Quickstart
description: Create a workspace, write a manifest, and run Boxfiles.
status: draft
category: tutorial
tags:
  - quickstart
  - tutorial
  - user
---

# User quickstart

## Goal

Create a small Boxfiles workspace, add a manifest, inspect discovery, then plan or apply it.

## 1. Create a workspace

```sh
mkdir workstation
cd workstation
mkdir -p modules/files
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

See [`copy` built-in plugin docs](/builtin/copy) for source path rules and planning behavior.

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

## 4. Reference manifest dependencies

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

## 5. Plan or apply

Compile a manifest plan:

```sh
boxfiles manifests plan
```

Apply a manifest when ready:

```sh
boxfiles apply modules.git
```
