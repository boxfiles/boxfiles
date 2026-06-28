#!/usr/bin/env bats

load "/repo/pkgs/e2e-common/helpers.sh"

setup() {
  setup_empty_fixture
}

write_rename_manifest() {
  local extra_config="${1:-}"
  write_manifest "rename.yaml" <<EOF
name: rename-test
steps:
  - uses: rename
    with:
      from: ~/.config/boxfiles/source.txt
      to: ~/.local/share/boxfiles/target.txt
$extra_config
EOF
}

@test "rename moves a workstation file and creates target parent dirs" {
  mkdir -p "$HOME/.config/boxfiles"
  printf 'renamed\n' > "$HOME/.config/boxfiles/source.txt"
  write_rename_manifest

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  [ ! -e "$HOME/.config/boxfiles/source.txt" ]
  assert_file_contains "$HOME/.local/share/boxfiles/target.txt" "renamed"
}

@test "rename fails when source is missing" {
  write_rename_manifest

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -ne 0 ]
  assert_output_contains "source does not exist:"
  assert_output_contains "$HOME/.config/boxfiles/source.txt"
  [ ! -e "$HOME/.local/share/boxfiles/target.txt" ]
}

@test "rename fails when target exists without overwrite" {
  mkdir -p "$HOME/.config/boxfiles" "$HOME/.local/share/boxfiles"
  printf 'source\n' > "$HOME/.config/boxfiles/source.txt"
  printf 'target\n' > "$HOME/.local/share/boxfiles/target.txt"
  write_rename_manifest

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -ne 0 ]
  assert_output_contains "target exists:"
  assert_output_contains "target.txt"
  assert_file_contains "$HOME/.config/boxfiles/source.txt" "source"
  assert_file_contains "$HOME/.local/share/boxfiles/target.txt" "target"
}

@test "rename overwrite true replaces existing file target" {
  mkdir -p "$HOME/.config/boxfiles" "$HOME/.local/share/boxfiles"
  printf 'source\n' > "$HOME/.config/boxfiles/source.txt"
  printf 'target\n' > "$HOME/.local/share/boxfiles/target.txt"
  write_rename_manifest "      overwrite: true"

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  [ ! -e "$HOME/.config/boxfiles/source.txt" ]
  assert_file_contains "$HOME/.local/share/boxfiles/target.txt" "source"
}

@test "rename overwrite true replaces existing directory target" {
  mkdir -p "$HOME/.config/boxfiles/source.txt" "$HOME/.local/share/boxfiles/target.txt"
  printf 'source\n' > "$HOME/.config/boxfiles/source.txt/source-file.txt"
  printf 'target\n' > "$HOME/.local/share/boxfiles/target.txt/target-file.txt"
  write_rename_manifest "      overwrite: true"

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  [ ! -e "$HOME/.config/boxfiles/source.txt" ]
  [ ! -e "$HOME/.local/share/boxfiles/target.txt/target-file.txt" ]
  assert_file_contains "$HOME/.local/share/boxfiles/target.txt/source-file.txt" "source"
}
