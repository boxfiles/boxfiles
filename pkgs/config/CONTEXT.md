# @boxfiles/config

Owns Boxfiles configuration loading and validation.

## Language

**Boxfiles Config**:
A merged configuration object containing declared plugins and settings.
_Avoid_: app config, runtime state

**Plugin Source**:
A config string that points at a plugin package or path, currently `npm:`, `git:`, or `file:`.
_Avoid_: provider id, action kind

**Settings**:
Optional policy knobs for fact collision and plugin loading.
_Avoid_: feature flags

## Boundaries

- This package validates config shape with TypeBox.
- This package reads user, project, environment, and default config through `nconf`.
- This package must not load plugins, gather facts, compile manifests, or execute plans.

## Flow

```text
config files/env/defaults
  -> BoxfileConfigSchema
  -> Config.store
  -> callers decide how to use config
```
