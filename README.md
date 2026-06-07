# boxfiles

## Installation

- releases tab
- download the latest release for your platform

## Usage

```sh
## help
boxfiles --help

## apply changes idepmotently to a module and all its children
boxfiles apply modulename
boxfiles apply modulename.childmodulename
boxfiles apply modulename.childmodulename.granchildmodulename
# start module tree at a specific path
boxfiles -d ./modulename/childmodulename apply granchildmodulename

## show manifests
boxfiles manifests # show module tree from current directory
boxfiles manifests modulename
boxfiles manifests modulename.childmodulename # show module tree starting at modulename.childmodulename

## show context 
boxfiles context # show context from current directory

## plugins
boxfiles plugins # show all plugins
```

## Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
