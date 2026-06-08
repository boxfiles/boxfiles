import copy from "./copy";
import gpu from "./gpu";
import link from "./link";
import network from "./network";
import os from "./os";
import ownership from "./ownership";
import packages from "./packages";
import permissions from "./permissions";
import remove from "./remove";
import rename from "./rename";
import storage from "./storage";
import user from "./user";
import type { BoxfilePlugin } from "../services/Plugins";

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
    rename,
    storage,
    user,
];
