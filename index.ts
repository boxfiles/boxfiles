import { didYouMeanPlugin, helpPlugin, versionPlugin } from "@crustjs/plugins";
import { app } from "./src/app";
import { manifestCmd } from "./src/cmds/manifests";

const cli = app
  .use(versionPlugin("0.0.0"))
  .use(didYouMeanPlugin({ mode: "help" }))
  .use(helpPlugin())
  .args([{ name: "cmd", type: "string", variadic: true }])
  .command(manifestCmd)
  .command("plan", (cmd) =>
    cmd
      .meta({ description: "Compile manifests into an execution plan." })
      .run(() => {
        console.log("plan: not implemented");
      }),
  )
  .run(({ args }) => {
    console.log("fallback:", args.cmd);
  });

await cli.execute({ argv: normalizeGlobalFlags(process.argv.slice(2)) });

function normalizeGlobalFlags(argv: readonly string[]): string[] {
  const globalFlags: string[] = [];
  const remaining: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;

    if (token === "-d" || token === "--dir") {
      const value = argv[index + 1];
      if (value === undefined) {
        remaining.push(token);
        continue;
      }

      globalFlags.push(token, value);
      index += 1;
      continue;
    }

    if (token.startsWith("--dir=")) {
      globalFlags.push(token);
      continue;
    }

    remaining.push(token);
  }

  const commandIndex = remaining.findIndex((token) => !token.startsWith("-"));
  if (commandIndex === -1 || globalFlags.length === 0) return remaining;

  return [
    ...remaining.slice(0, commandIndex + 1),
    ...globalFlags,
    ...remaining.slice(commandIndex + 1),
  ];
}
