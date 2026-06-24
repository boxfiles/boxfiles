#!/usr/bin/env bash

REPO_DIR="${REPO_DIR:-/repo}"
BOXFILES_BIN="${BOXFILES_BIN:-$REPO_DIR/apps/cli/dist/boxfiles-linux-x64}"

setup_demo_fixture() {
  export DEMO_FIXTURE_ROOT="$BATS_TEST_TMPDIR/demo"
  export HOME="$BATS_TEST_TMPDIR/home"

  mkdir -p "$DEMO_FIXTURE_ROOT" "$HOME"
  cp -R "$REPO_DIR/apps/demo/." "$DEMO_FIXTURE_ROOT"/
}

setup_empty_fixture() {
  export DEMO_FIXTURE_ROOT="$BATS_TEST_TMPDIR/workspace"
  export HOME="$BATS_TEST_TMPDIR/home"

  mkdir -p "$DEMO_FIXTURE_ROOT" "$HOME"
}

write_manifest() {
  local relative_path="$1"
  mkdir -p "$(dirname "$DEMO_FIXTURE_ROOT/$relative_path")"
  cat >"$DEMO_FIXTURE_ROOT/$relative_path"
}

assert_boxfiles_bin() {
  [ -x "$BOXFILES_BIN" ]
}

assert_output_contains() {
  local needle="$1"
  [[ "$output" == *"$needle"* ]]
}

assert_file_contains() {
  local path="$1"
  local needle="$2"
  [ -f "$path" ]
  run grep -F "$needle" "$path"
  [ "$status" -eq 0 ]
}
