# Boxfiles

A cli/gui for workstation provisioning.

Think of it as ansible lite. Low ceremony, but extensible.

## Inspiration

Comtrya was a rust project that allowed a user to provide some toml or yaml files that describe actions to perform on their system.

The available actions to perform are provided via a DSL of building blocks and some or all actions in a file can be gated behind `if` checks.

files of actions become modules. gaining a naming convention that mirrors their relative location to the resolved root.

Ordering is possible by declaring that a module depends on other modules. This simply means other modules must first run.

## Glossary

### Module

A file that contains actions, dependencies and conditions.

On disk, modules are treated as template language (like jinja) in order to support interpolation of facts into conditions, dependencies and actions.

A manifest may have a sibling `files/` directory for source assets. Built-in `copy` actions resolve `from` relative to that manifest-local `files/` directory, so manifests reference asset names directly instead of adding `./files` prefixes.

```text
modules/git.yaml
modules/files/gitconfig
```

```yaml
steps:
  - id: copy-gitconfig
    uses: copy
    with:
      from: gitconfig
      to: ~/.gitconfig
```

### Action

The smallest operating building block. It abstracts the OS-specific way of performing a common operation.

### Plugin

A capability module. It may provide actions, context facts, or both.

### Context

A collection of derived facts about the current user and current system. These will can be used throughout a modules conditions, actions and dependencies.

Context can come from four places:

- System: facts about the system, such as osinfo, hardware, pkgs, env vars, etc.
- User: facts about the user, such as homedir, username, groups, etc.
- Project: facts about the project, such as pwd, upstreamrepo, etc.
- Plugin: facts supplied by plugin context providers.

A user can also generate facts by placing files in `~/.config/boxfiles` and hidden `.boxfilesrc.{json,yaml,yml,toml}` files. These files will be parsed and their contents will be added to the context as facts. The user can use these facts in their modules.

Various template language dls constructs will be available to the user within `.boxfilesrc.{json,yaml,yml,toml}` files in order to generate useful and interesting facts. For example, a user could generate a fact that contains the output of a command, or the contents of a file, or the result of some computation.


## Process

```text
CLI load
  -> read `.boxfilesrc.{json,yaml,yml,toml}` files in local and xdg config dir
  -> parse plugin modules
  -> validate plugin shape
  -> gather manifests
  -> gather system/user/project/plugin facts
  -> compile context snapshot
  -> compile manifests/templates
  -> resolve action providers
  -> build plan from conditions and dependencies
  -> execute confirmed plan
```

