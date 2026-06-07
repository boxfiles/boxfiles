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

### Action

The smallest operating building block. abstracts OS way of performing a common action, for example: 

### Context

A collection of derived facts about the current user and current system. These will can be used throughout a modules conditions, actions and dependencies.

Context can come from three places:

- System: facts about the system, such as osinfo, hardware, pkgs, env vars, etc.
- User: facts about the user, such as homedir, username, groups, etc.
- Project: facts about the project, such as pwd, upstreamrepo, etc.

A user can also generate facts by placing files in `~/.config/boxfiles` and `.boxfilesrc{yaml|toml}`. These files will be parsed and their contents will be added to the context as facts. The user can use these facts in their modules.

Various template language dls constructs will be available to the user within the `.boxfilesrc` in order to generate useful and interesting facts. For example, a user could generate a fact that contains the output of a command, or the contents of a file, or the result of some computation.


## Process

1. exec boxfiles
2. gather facts:
  a. boxfile modules from fs
  b. system facts: (env, osinfo, hardware, pkgs)
  c. user facts: (homedir, username, groups, generated facts from ~/.config/boxfiles)
  d. project facts: (pwd, upstreamrepo, generated facts from .boxfilesrc{yaml|toml})

4. compile context: merge gathered facts  
5. compile modules: interpolate facts into modules
6. build module plan: resolve conditions and dependencies
7. execute module plan.
