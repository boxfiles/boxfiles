#!/usr/bin/env bats

load "/repo/pkgs/e2e-common/helpers.sh"

setup() {
  setup_demo_fixture
  mkdir -p "$DEMO_FIXTURE_ROOT/files"
}

write_copy_manifest() {
  write_manifest "copy-test.yaml" <<EOF
name: copy-test
steps:
  - uses: copy
    with:
      from: source.txt
      to: ~/.config/boxfiles/copy-target.txt
      overwrite: $1
EOF
}

@test "copy creates parent dirs and target file" {
  printf 'first\n' > "$DEMO_FIXTURE_ROOT/files/source.txt"
  write_copy_manifest "false"

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  assert_file_contains "$HOME/.config/boxfiles/copy-target.txt" "first"
}

@test "copy respects overwrite false" {
  mkdir -p "$HOME/.config/boxfiles"
  printf 'existing\n' > "$HOME/.config/boxfiles/copy-target.txt"
  printf 'replacement\n' > "$DEMO_FIXTURE_ROOT/files/source.txt"
  write_copy_manifest "false"

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  assert_file_contains "$HOME/.config/boxfiles/copy-target.txt" "existing"
  run grep -F "replacement" "$HOME/.config/boxfiles/copy-target.txt"
  [ "$status" -ne 0 ]
}

@test "copy overwrite true replaces target" {
  mkdir -p "$HOME/.config/boxfiles"
  printf 'existing\n' > "$HOME/.config/boxfiles/copy-target.txt"
  printf 'replacement\n' > "$DEMO_FIXTURE_ROOT/files/source.txt"
  write_copy_manifest "true"

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  assert_file_contains "$HOME/.config/boxfiles/copy-target.txt" "replacement"
}

@test "copy rejects parent traversal source" {
  write_manifest "bad-copy.yaml" <<'EOF'
name: bad-copy
steps:
  - uses: copy
    with:
      from: ../secret
      to: ~/.config/boxfiles/bad
EOF

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" manifests plan

  [ "$status" -ne 0 ]
}
