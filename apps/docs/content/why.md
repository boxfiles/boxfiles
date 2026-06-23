---
title: Why Boxfiles
description: Why Boxfiles exists, what it optimizes for, and where it should not be used.
---

# Why Boxfiles

Boxfiles is workstation provisioning with less ceremony than Ansible and less commitment than Nix.

Use it when you want a repo of small manifests that can copy files, create links, install packages, run narrow setup steps, and explain the plan before touching the machine.

## The problem

Most workstation setup starts as shell scripts. That works until the scripts need ordering, reuse, machine-specific branches, or a dry-run view.

Full configuration-management systems solve those problems, but they bring server/fleet assumptions, inventory models, roles, and runtime weight that feel oversized for one laptop or a small set of personal machines.

Boxfiles sits in that gap.

```text
plain dotfiles
  -> scattered scripts
  -> Boxfiles manifests + plan
  -> full fleet config management, if you really need it
```

## What Boxfiles optimizes for

### Local-first setup

A Boxfiles workspace is a normal directory. Manifests live beside the files they manage, so a module can own both intent and assets:

```text
modules/git.yaml
modules/files/gitconfig
```

### Plan before apply

Boxfiles compiles manifests into a plan before execution. The plan shows what action provider will run, what target it affects, and whether the provider marks it as safe or unsafe.

That makes review cheap. It also keeps parsing, context gathering, planning, and applying as separate phases.

### Small manifests

Manifests describe actions, dependencies, and conditions. Manifest IDs come from paths, so directory structure becomes the namespace:

```text
modules/git.yaml -> modules.git
base/packages.yaml -> base.packages
```

Dependencies stay explicit instead of hidden inside script order.

### Capability plugins

Plugins provide capabilities, not random command bags. A plugin can add context facts, action providers, or both.

That keeps built-ins small while still allowing local policy: package managers, OS facts, hardware checks, file operations, and project-specific setup can live behind typed providers.

## Why not just shell scripts?

Shell is still fine for one-off setup. Use it when the task is linear, single-platform, and obvious.

Boxfiles helps when you need:

- discovery of many manifests
- dependency ordering between modules
- a plan before mutation
- typed action config
- reusable providers
- context facts for OS, user, project, or plugin state
- cross-platform setup across Windows, macOS, and Linux
- conditional primitives like `when` instead of hand-rolled shell branches

## Why not Ansible?

Ansible is powerful, mature, and better for remote hosts or teams already invested in its ecosystem.

Boxfiles is smaller on purpose. It focuses on local workstation setup, local files, predictable manifest discovery, and a lighter plugin contract.

## Why not Nix?

Nix is strong when you want deep reproducibility and accept its model, but that model is heavy for normal workstation setup.

Boxfiles avoids making every dotfile change a packaging exercise. It is for users who want incremental setup automation without turning their workstation into a full declarative operating-system project.

## What Boxfiles is not

Boxfiles is not a sandbox for untrusted code. Plugin code runs inside the trusted local config boundary.

Boxfiles is not a perfect reproducibility system yet. Plugin lockfiles and stronger execution safety policy are deferred work.

Boxfiles is not meant to hide every OS detail. Providers should abstract common operations, but workstation setup still has machine-specific edges.

## Good fit

Use Boxfiles when you want:

- dotfiles plus actions
- explicit setup order
- reviewable plans
- local manifests in YAML or TOML
- plugins for missing capabilities
- low ceremony over total control

## Bad fit

Reach for another tool when you need:

- remote fleet orchestration
- untrusted plugin isolation
- strict bit-for-bit reproducibility
- enterprise policy enforcement
- a general task runner with no provisioning model

Boxfiles should stay boring: discover manifests, gather facts, compile a plan, then apply it when the user asks.
