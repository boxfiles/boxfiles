# @boxfiles/plugin

Owns plugin shape, registration, source parsing, plugin cache install/remove, plugin loading, and context fact gathering from plugins.

## Language

**Boxfile Plugin**:
A capability module with an id, optional context facts, and optional action providers.
_Avoid_: provider package

**Plugin Registry**:
The in-memory registry of plugins and action providers.
_Avoid_: service locator

**Plugin Source**:
A declared plugin location: `npm:`, `git:`, or `file:`.
_Avoid_: package name only

**Plugin Cache Entry**:
A local cache directory for cacheable npm/git plugin artifacts.
_Avoid_: install directory

**Plugin Context Fact**:
A context fact resolved from a plugin context definition during fact gathering.
_Avoid_: template variable

## Boundaries

- This package normalizes plugin modules and rejects bad shapes.
- This package registers plugins and detects duplicate plugin/action ids.
- This package installs and removes plugin declarations in `.boxfilesrc`.
- This package gathers plugin context facts into `ContextService`.
- This package must not parse manifests, compile plans, or implement built-in provider behavior.

## Flow

```text
.boxfilesrc plugin source
  -> parse source
  -> resolve/cache/load module
  -> normalize Boxfile Plugin
  -> Plugin Registry
  -> gather Plugin Context Facts / resolve Action Providers
```
