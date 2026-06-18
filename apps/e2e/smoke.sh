#!/usr/bin/env bats

REPO_DIR="/repo"

setup() {
  export BOXFILES_BIN="$REPO_DIR/apps/cli/dist/boxfiles-linux-x64"
  export DEMO_FIXTURE_ROOT="$REPO_DIR/demo"
  export HOME="$BATS_TEST_TMPDIR/home"

  mkdir -p "$DEMO_FIXTURE_ROOT" "$HOME"
  cp -R /repo/apps/demo/. "$DEMO_FIXTURE_ROOT"/
  rm -f "$DEMO_FIXTURE_ROOT/failure.yaml" "$DEMO_FIXTURE_ROOT/skipped.yaml"
}

write_failing_manifest() {
  cat >"$DEMO_FIXTURE_ROOT/failure.yaml" <<'EOF'
name: failure
steps:
  - uses: run
    with:
      command: false
  - uses: run
    with:
      command: touch ~/.config/boxfiles/failure-hit
EOF
}

write_skipped_manifest() {
  cat >"$DEMO_FIXTURE_ROOT/skipped.yaml" <<'EOF'
name: skipped
steps:
  - uses: run
    when: "false"
    with:
      command: touch ~/.config/boxfiles/skip-hit
EOF
}
@test "apply dry-run does not mutate" {
  [ -x "$BOXFILES_BIN" ]
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" == *"Apply Dry Run"* ]]
  [[ "$output" == *"workstation"* ]]
  [ ! -f "$HOME/.config/boxfiles/welcome.json" ]
}

@test "apply live mutates target file" {
  [ -x "$BOXFILES_BIN" ]
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm
  [ "$status" -eq 0 ]
  [ -f "$HOME/.config/boxfiles/welcome.json" ]
  run cat "$HOME/.config/boxfiles/welcome.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"welcome"* ]]
}

@test "apply stops on first failure" {
  write_failing_manifest

  [ -x "$BOXFILES_BIN" ]
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm
  [ "$status" -ne 0 ]
  [[ "$output" == *"run failed"* ]]
  [ ! -f "$HOME/.config/boxfiles/failure-hit" ]
}

@test "apply skips false when" {
  write_skipped_manifest

  [ -x "$BOXFILES_BIN" ]
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm
  [ "$status" -eq 0 ]
  [ ! -f "$HOME/.config/boxfiles/skip-hit" ]
}

@test "apply rejects unsafe without confirm" {
  write_failing_manifest

  [ -x "$BOXFILES_BIN" ]
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply
  [ "$status" -ne 0 ]
  [[ "$output" == *"unsafe action requires --confirm"* ]]
}
