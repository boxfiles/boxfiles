import copy from "@boxfiles/provider-copy";
import gpu from "@boxfiles/provider-gpu";
import link from "@boxfiles/provider-link";
import network from "@boxfiles/provider-network";
import os from "@boxfiles/provider-os";
import ownership from "@boxfiles/provider-ownership";
import packages from "@boxfiles/provider-packages";
import permissions from "@boxfiles/provider-permissions";
import remove from "@boxfiles/provider-remove";
import run from "@boxfiles/provider-run";
import rename from "@boxfiles/provider-rename";
import storage from "@boxfiles/provider-storage";
import user from "@boxfiles/provider-user";
import type { BoxfilePlugin } from "@boxfiles/core";

export const builtInPlugins: readonly BoxfilePlugin[] = [
  copy,
  gpu,
  link,
  network,
  os,
  ownership,
  packages,
  permissions,
  remove,
  run,
  rename,
  storage,
  user,
];
