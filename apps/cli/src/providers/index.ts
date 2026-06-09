import copy from "@zenobius/boxfiles-provider-copy";
import gpu from "@zenobius/boxfiles-provider-gpu";
import link from "@zenobius/boxfiles-provider-link";
import network from "@zenobius/boxfiles-provider-network";
import os from "@zenobius/boxfiles-provider-os";
import ownership from "@zenobius/boxfiles-provider-ownership";
import packages from "@zenobius/boxfiles-provider-packages";
import permissions from "@zenobius/boxfiles-provider-permissions";
import remove from "@zenobius/boxfiles-provider-remove";
import run from "@zenobius/boxfiles-provider-run";
import rename from "@zenobius/boxfiles-provider-rename";
import storage from "@zenobius/boxfiles-provider-storage";
import user from "@zenobius/boxfiles-provider-user";
import type { BoxfilePlugin } from "@zenobius/boxfiles-core";

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
