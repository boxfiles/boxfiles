import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { TSchema } from "typebox";
import { app } from "../app";
import { formatCommandError } from "../common/console";
import { getActiveRuntime } from "../runtime";
import {
  BoxfilesRcFileSchema,
  ManifestSchema,
  RuntimeRootMismatchError,
  UnknownSchemaNameError,
} from "@boxfiles/core";
import { markdownView } from "../views/markdown";

const SCHEMA_DRAFT_URL = "https://json-schema.org/draft/2020-12/schema";
const DEFAULT_SCHEMA_DIR = ".boxfiles/schemas";


export const schemaCmd = app
  .sub("schema")
  .meta({
    description: "Write Boxfiles JSON Schema files.",
  })
  .flags({
    out: {
      type: "path",
      short: "o",
      description: "Directory for generated JSON Schema files. Defaults to BOXFILES_SCHEMA_DIR or <dir>/.boxfiles/schemas.",
    },
    name: {
      type: "string",
      short: "n",
      description: "Schema to write: all, manifest, or boxfilesrc. Defaults to BOXFILES_SCHEMA_NAME or all.",
    },
  })
  .run(async (input) => {
    await runSchemaCommand(async () => {
      await writeSchemaFilesFromInput(
        input.flags.dir,
        readOptionalStringFlag(input.flags, "out"),
        readOptionalStringFlag(input.flags, "name"),
      );
    });
  });

type SchemaName = "all" | "manifest" | "boxfilesrc";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
type JsonObject = { readonly [key: string]: JsonValue };

type SchemaFile = {
  readonly name: Exclude<SchemaName, "all">;
  readonly fileName: string;
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly schema: TSchema;
};

type WrittenSchemaFile = {
  readonly name: string;
  readonly path: string;
};

const SCHEMA_FILES: readonly SchemaFile[] = [
  {
    name: "manifest",
    fileName: "manifest.schema.json",
    id: "https://boxfiles.dev/schemas/manifest.schema.json",
    title: "Boxfiles manifest",
    description: "A Boxfiles manifest file containing dependencies, conditions, and action steps.",
    schema: ManifestSchema,
  },
  {
    name: "boxfilesrc",
    fileName: "boxfilesrc.schema.json",
    id: "https://boxfiles.dev/schemas/boxfilesrc.schema.json",
    title: "Boxfiles rc config",
    description: "A Boxfiles rc config file that declares plugins and contributes project or user facts.",
    schema: BoxfilesRcFileSchema,
  },
];

async function runSchemaCommand(command: () => Promise<void>): Promise<void> {
  try {
    await command();
  } catch (error) {
    process.exitCode = 1;
    console.error(formatCommandError(error));
  }
}

function readOptionalStringFlag(
  flags: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = flags[key];
  if (typeof value !== "string") return undefined;
  return value;
}

async function writeSchemaFilesFromInput(
  rootDir: string,
  outputFlag: string | undefined,
  nameFlag: string | undefined,
): Promise<void> {
  const runtime = getActiveRuntime();
  if (runtime.rootDir !== rootDir) {
    throw new RuntimeRootMismatchError(rootDir, runtime.rootDir);
  }

  const outputDir = resolveSchemaOutputDir(rootDir, outputFlag, process.env.BOXFILES_SCHEMA_DIR);
  const schemaName = parseSchemaName(firstNonBlank(nameFlag, process.env.BOXFILES_SCHEMA_NAME, "all"));
  const written = await writeSchemaFiles({
    rootDir,
    outputDir,
    schemaName,
  });

  console.log(markdownView(renderWrittenSchemas(outputDir, written)));
}

export async function writeSchemaFiles(options: {
  readonly rootDir: string;
  readonly outputDir: string;
  readonly schemaName: SchemaName;
}): Promise<readonly WrittenSchemaFile[]> {
  await fs.mkdir(options.outputDir, { recursive: true });

  const schemas = selectSchemaFiles(options.schemaName);
  const written: WrittenSchemaFile[] = [];

  for (const schemaFile of schemas) {
    const outputPath = path.join(options.outputDir, schemaFile.fileName);
    const jsonSchema = createJsonSchemaDocument(schemaFile);
    await fs.writeFile(outputPath, `${JSON.stringify(jsonSchema, null, 2)}\n`, "utf-8");
    written.push({
      name: schemaFile.name,
      path: path.relative(options.rootDir, outputPath),
    });
  }

  return written;
}

export function resolveSchemaOutputDir(
  rootDir: string,
  outputFlag: string | undefined,
  envOutputDir: string | undefined,
): string {
  const selected = firstNonBlank(outputFlag, envOutputDir, DEFAULT_SCHEMA_DIR);
  if (path.isAbsolute(selected)) return selected;

  return path.resolve(rootDir, selected);
}

function firstNonBlank(...values: readonly (string | undefined)[]): string {
  for (const value of values) {
    if (value === undefined) continue;
    if (value.trim().length === 0) continue;
    return value;
  }

  return DEFAULT_SCHEMA_DIR;
}

function parseSchemaName(value: string): SchemaName {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "all":
    case "manifest":
    case "boxfilesrc":
      return normalized;
    default:
      throw new UnknownSchemaNameError(value);
  }
}

function selectSchemaFiles(schemaName: SchemaName): readonly SchemaFile[] {
  switch (schemaName) {
    case "all":
      return SCHEMA_FILES;
    case "manifest":
    case "boxfilesrc":
      return SCHEMA_FILES.filter((schemaFile) => schemaFile.name === schemaName);
  }
}

function createJsonSchemaDocument(schemaFile: SchemaFile): JsonObject {
  return {
    $schema: SCHEMA_DRAFT_URL,
    $id: schemaFile.id,
    title: schemaFile.title,
    description: schemaFile.description,
    ...schemaFile.schema,
  } as JsonObject;
}

function renderWrittenSchemas(outputDir: string, written: readonly WrittenSchemaFile[]): string {
  const lines: string[] = ["# Schema files written", "", `Output directory: ${outputDir}`, ""];
  if (written.length === 0) {
    lines.push("No schema files were written.");
    return lines.join("\n");
  }

  for (const item of written) {
    lines.push(`- ${item.name}: \`${item.path}\``);
  }

  return lines.join("\n");
}
