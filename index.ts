import { Crust } from "@crustjs/core";
import { didYouMeanPlugin, helpPlugin, versionPlugin } from "@crustjs/plugins";

const app = new Crust("boxfiles")
  .meta({
    description: "Provision workstations from typed boxfile manifests.",
  })
  .use(versionPlugin("0.0.0"))
  .use(didYouMeanPlugin({ mode: "help" }))
  .use(helpPlugin())
  .args([{ name: "cmd", type: "string", variadic: true }])
  .command("plan", (cmd) =>
    cmd.meta({ description: "Compile manifests into an execution plan." }).run(() => {
      console.log("plan: not implemented");
    }),
  )
  .run(({ args }) => {
    console.log("fallback:", args.cmd);
  });

await app.execute();
