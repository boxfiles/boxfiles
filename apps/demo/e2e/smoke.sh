#!/usr/bin/env bats

@test "demo artifacts exist" {
  [ -f /repo/apps/demo/workstation.yaml ]
  [ -f /repo/dist/boxfiles-linux-x64 ]
}
