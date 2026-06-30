# Boxfiles

Boxfiles is a workstation provisioning system that describes desired workstation setup as manifests and turns them into provider-backed plans.

## Language

**Provider**:
A plugin capability that contributes facts or actions to Boxfiles.
_Avoid_: module, adapter

**Context Fact**:
A named value about the workstation or project used during planning.
_Avoid_: variable, template value

**Lazy Context Fact**:
A **Context Fact** whose value is computed only when referenced during planning.
_Avoid_: dynamic context fact, runtime fact

**Sensitive Context Fact**:
A **Context Fact** whose value must be redacted from human-readable plans and diagnostics.
_Avoid_: secret variable, hidden field

**Template Context Path**:
A dot-separated **Context Fact** name that can be addressed as Liquid property access.
_Avoid_: arbitrary fact key, alias

**Context Namespace**:
A reserved top-level name that groups related **Context Facts** in templates.
_Avoid_: local variable, scope object

**OS Context Fact**:
A **Context Fact** about the workstation operating system that is gathered without changing workstation state.
_Avoid_: inventory item, diagnostic field

**Baseline OS Identity Fact**:
An **OS Context Fact** that identifies the workstation OS without performing rich hardware, package, container, WSL, or libc inventory.
_Avoid_: system inventory, hardware inventory

**User Context Fact**:
A **Context Fact** about the current workstation user that is gathered without changing workstation state.
_Avoid_: OS user field, account inventory


**POSIX User Account Fact**:
A **User Context Fact** about POSIX account attributes such as numeric user id, group id, home directory, or login shell.
_Avoid_: required user field, account database

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
- A **Context Namespace** contains one or more **Context Facts** and must not be shadowed by template-local names.
- A **Context Namespace** has exactly one owning **Provider**.
- A **Lazy Context Fact** must be declared before it can be referenced in a template.
- A **Lazy Context Fact** has one stable value within a single **Plan**.
- A referenced **Lazy Context Fact** that cannot be resolved fails planning.
- A **Lazy Context Fact** may depend only on declared **Context Facts**.
- A **Context Fact** must be resolved without changing workstation state.
- A **Provider** declares whether a **Context Fact** is sensitive.
- A **Template Context Path** uses Liquid-safe identifier segments.
- An **OS Context Fact** is a **Context Fact** with a stable `os.*` name.
- A **User Context Fact** is a **Context Fact** with a stable `user.*` name.
- A **POSIX User Account Fact** may be omitted when the platform cannot report it.
- A user's home directory is a **User Context Fact**, not an **OS Context Fact**.
## Example dialogue

> **Dev:** "Should the os provider change workstation state?"
> **Domain expert:** "No. The **Provider** only exposes **Context Facts**; actions belong to action providers."

## Flagged ambiguities

- "provider" was used broadly; resolved: the `os` **Provider** should provide **Context Facts** only, not actions.
- "os" was considered as a single aggregate fact; resolved: **OS Context Facts** use stable flat `os.*` names.
- "unknown" was considered for unavailable OS facts; resolved: unavailable **OS Context Facts** are omitted, not represented as placeholder values.
- "username" was owned by `os.user.username`; resolved: current workstation user identity belongs to **User Context Facts** under `user.*`, not **OS Context Facts**.
- "POSIX user facts" are not guaranteed on every platform; resolved: unavailable **POSIX User Account Facts** are omitted, not represented as placeholders.
- "home directory" was owned by `os.homedir`; resolved: current workstation home directory belongs to **User Context Facts** under `user.*`, not **OS Context Facts**.

- "context as runtime properties" was ambiguous; resolved: templates use reserved **Context Namespaces** and shadowing them is an error.
- "fact key" was broader than Liquid property access; resolved: template-addressable facts use **Template Context Paths**.