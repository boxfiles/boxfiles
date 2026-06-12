import Schema from "typebox/schema";
import { BoxfilesRcValidationError } from "../../exceptions/config";
import type { TypeboxValidationErrorLike } from "../../exceptions/manifest";
import {
  BoxfilesRcFileSchema,
  type BoxfilesRcConfigDto,
  type BoxfilesRcFileDto,
} from "./schema";

const BoxfilesRcFileDtoParser = Schema.Compile(BoxfilesRcFileSchema);

export const BoxfilesRcConfigDTO = {
  parse(raw: unknown): BoxfilesRcConfigDto {
    let parsed: BoxfilesRcFileDto;

    try {
      parsed = BoxfilesRcFileDtoParser.Parse(raw);
    } catch (error) {
      if (isTypeboxValidationErrorLike(error)) {
        throw new BoxfilesRcValidationError(raw, error);
      }

      throw error;
    }

    return normalizeBoxfilesRcConfig(parsed);
  },
};

function normalizeBoxfilesRcConfig(config: BoxfilesRcFileDto): BoxfilesRcConfigDto {
  return {
    settings: config.settings,
    plugins: Object.entries(config.plugins ?? {}).map(([name, source]) => ({
      name,
      source,
    })),
  };
}

function isTypeboxValidationErrorLike(
  error: unknown,
): error is TypeboxValidationErrorLike {
  if (!error || typeof error !== "object" || Array.isArray(error)) return false;
  if (!("schema" in error)) return false;
  if (!("value" in error)) return false;
  if (!("errors" in error)) return false;

  const errors = (error as { readonly errors: unknown }).errors;
  return Array.isArray(errors);
}
