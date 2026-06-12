import { readFile } from "node:fs/promises";
import {
  BoxfilesRcParseError,
  BoxfilesRcReadError,
} from "../../exceptions/config";
import { BoxfilesRcConfigDTO } from "./parse";
import type { BoxfilesRcConfigDto } from "./schema";

export interface BoxfilesRcFileSystem {
  readFile(path: string, encoding: "utf8"): Promise<string>;
}

export type BoxfilesRcMissingFilePolicy = "default-empty" | "throw";

export interface ReadBoxfilesRcConfigOptions {
  readonly fs?: BoxfilesRcFileSystem;
  readonly missingFile?: BoxfilesRcMissingFilePolicy;
}

const nodeBoxfilesRcFileSystem: BoxfilesRcFileSystem = {
  readFile(path: string, encoding: "utf8"): Promise<string> {
    return readFile(path, encoding);
  },
};

export async function readBoxfilesRcConfig(
  path: string,
  options: ReadBoxfilesRcConfigOptions = {},
): Promise<BoxfilesRcConfigDto> {
  const fs = options.fs ?? nodeBoxfilesRcFileSystem;
  const missingFile = options.missingFile ?? "default-empty";
  let text: string;

  try {
    text = await fs.readFile(path, "utf8");
  } catch (error) {
    if (missingFile === "default-empty" && hasErrorCode(error, "ENOENT")) {
      return BoxfilesRcConfigDTO.parse({});
    }

    throw new BoxfilesRcReadError(path, error);
  }

  let raw: unknown;

  try {
    raw = JSON.parse(text) as unknown;
  } catch (error) {
    throw new BoxfilesRcParseError(path, error);
  }

  return BoxfilesRcConfigDTO.parse(raw);
}

function hasErrorCode(value: unknown, code: string): boolean {
  return typeof value === "object"
    && value !== null
    && "code" in value
    && value.code === code;
}
