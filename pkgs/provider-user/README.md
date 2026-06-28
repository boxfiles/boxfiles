# @boxfiles/provider-user

User context provider for Boxfiles.

## Context facts

This provider emits facts about the current workstation user when Node can report them:

- `user.username`
- `user.uid`
- `user.gid`
- `user.homedir`
- `user.shell`

Unavailable facts are omitted. Empty strings, negative ids, and non-finite ids are not emitted.

## Actions

No actions are implemented.
