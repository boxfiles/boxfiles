#!/usr/bin/env bash
set -euo pipefail

: "${MOON_WORKSPACE_ROOT:?MOON_WORKSPACE_ROOT is required}"
ROOT_DIR="$MOON_WORKSPACE_ROOT"

if [ ! -d "$ROOT_DIR/.agents" ]; then
	echo "missing .agents directory at repo root" >&2
	exit 1
fi

declare -A harnesses=()
declare -A skills=()
declare -A commands=()

harnesses[pi]=".pi"
skills[pi]=".pi/skills"
commands[pi]=".pi/prompts"

for name in "${!harnesses[@]}"; do
	harness_dir="$ROOT_DIR/${harnesses[$name]}"
	skills_target="$ROOT_DIR/${skills[$name]}"
	commands_target="$ROOT_DIR/${commands[$name]}"

	if [ ! -d "$harness_dir" ]; then
		echo "skipping '$name': missing harness dir $harness_dir"
		continue
	fi

	mkdir -p "$(dirname "$skills_target")" "$(dirname "$commands_target")"

	ln -sfn "$ROOT_DIR/.agents/skills" "$skills_target"
	ln -sfn "$ROOT_DIR/.agents/commands" "$commands_target"

	echo "linked $name harness"
	echo "  $skills_target -> $ROOT_DIR/.agents/skills"
	echo "  $commands_target -> $ROOT_DIR/.agents/commands"
done
