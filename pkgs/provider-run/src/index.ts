import Type from "typebox";
import Schema from "typebox/schema";
import { Bash, ReadWriteFs } from "just-bash";
import { NonBlankStringSchema } from "@boxfiles/core";
import { type ActionProvider } from "@boxfiles/core";
import { createPlugin } from "@boxfiles/plugin";

const RunConfigSchema = Type.Object({
  command: Type.Readonly(NonBlankStringSchema),
  check: Type.Readonly(Type.Optional(NonBlankStringSchema)),
});

const RunConfigParser = Schema.Compile(RunConfigSchema);

const runActionProvider: ActionProvider<typeof RunConfigSchema> = {
  kind: "run",
  schema: RunConfigSchema,

  validate(config) {
    if (!RunConfigParser.Check(config)) {
      return {
        success: false,
        errors: ["Invalid run action config"],
      };
    }

    return {
      success: true,
      value: RunConfigParser.Parse(config),
    };
  },

  async plan(input) {
    return {
      actionId: input.action.id,
      manifestId: input.action.manifestId,
      kind: input.action.uses,
      summary: input.action.config.check === undefined
        ? `Run ${input.action.config.command}`
        : `Check ${input.action.config.check} then run ${input.action.config.command}`,
      safety: {
        idempotent: input.action.config.check !== undefined,
        unsafe: true,
        reason: "arbitrary command execution may mutate workstation state",
      },
      changes: [
        {
          target: input.ctx.rootDir,
          operation: "execute",
          before: undefined,
          after: {
            command: input.action.config.command,
          },
          message: "run shell command",
        },
      ],
    };
  },

  async apply(input) {
    const fs = new ReadWriteFs({ root: input.ctx.rootDir });
    const bash = new Bash({ fs });

    if (input.action.config.check !== undefined) {
      const checkResult = await bash.exec(input.action.config.check);
      if (checkResult.exitCode === 0) {
        return {
          actionId: input.action.id,
          success: true,
          message: checkResult.stdout.trimEnd(),
        };
      }
    }

    const result = await bash.exec(input.action.config.command);

    if (result.exitCode === 0) {
      return {
        actionId: input.action.id,
        success: true,
        message: result.stdout.trimEnd(),
      };
    }

    return {
      actionId: input.action.id,
      success: false,
      message:
        result.stderr.trimEnd() ||
        `run failed with exit code ${result.exitCode}`,
    };
  },
};

export default createPlugin({
  id: "run",
  actions: {
    run: runActionProvider,
  },
});
