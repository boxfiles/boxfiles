import { Crust } from "@crustjs/core";

export const app = new Crust("boxfiles")
  .meta({
    description: "Provision workstations from typed boxfile manifests.",
  })
  .flags({
    dir: {
      type: "path",
      short: "d",
      inherit: true,
      default: process.cwd(),
      description:
        "Root directory to use for manifest discovery and execution.",
    },
  });
