# Boxfiles

Boxfiles is a workstation provisioning system that describes desired workstation setup as manifests and turns them into provider-backed plans.

## Language

**Provider**:
A plugin capability that contributes facts or actions to Boxfiles.
_Avoid_: module, adapter

**Context Fact**:
A named value about the workstation or project used during planning.
_Avoid_: variable, template value

**OS Context Fact**:
A **Context Fact** about the workstation operating system that is gathered without changing workstation state.
_Avoid_: inventory item, diagnostic field

**Baseline OS Identity Fact**:
An **OS Context Fact** that identifies the workstation OS without performing rich hardware, package, container, WSL, or libc inventory.
_Avoid_: system inventory, hardware inventory

**Manifest**:
A file that declares provisioning steps and dependencies.
_Avoid_: playbook, script

**Plan**:
An ordered description of proposed workstation changes compiled from manifests and facts.
_Avoid_: run, execution

## Relationships

- A **Provider** may expose zero or more **Context Facts**.
- A **Manifest** compiles into part of a **Plan**.
- A **Plan** may use **Context Facts** when providers calculate proposed changes.
- An **OS Context Fact** is a **Context Fact** with a stable `os.*` name.

## Example dialogue

> **Dev:** "Should the os provider change workstation state?"
> **Domain expert:** "No. The **Provider** only exposes **Context Facts**; actions belong to action providers."

## Flagged ambiguities

- "provider" was used broadly; resolved: the `os` **Provider** should provide **Context Facts** only, not actions.
- "os" was considered as a single aggregate fact; resolved: **OS Context Facts** use stable flat `os.*` names.
- "unknown" was considered for unavailable OS facts; resolved: unavailable **OS Context Facts** are omitted, not represented as placeholder values.
