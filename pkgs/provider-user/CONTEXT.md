# @boxfiles/provider-user

Owns current workstation user context facts.

## Language

**User Provider**:
A built-in provider that exposes `user.*` context facts and does not mutate workstation state.
_Avoid_: account manager

**User Context Fact**:
A namespaced context fact describing the current workstation user.
_Avoid_: OS fact

**POSIX User Account Fact**:
An optional numeric or shell fact from `os.userInfo()` when the platform can report it.
_Avoid_: required user field

## Boundaries

- This provider exposes context only; it has no actions.
- Facts are omitted when unavailable; never emit `unknown` or `null` placeholders.
- Home directory belongs under `user.homedir`, not `os.*`.
- Do not enumerate users or mutate accounts.

## Flow

```text
plugin context request
  -> createUserContext cached snapshot
  -> node:os userInfo
  -> ContextService stores user.* facts
```
