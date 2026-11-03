import { readJSON, fail } from "./io.mjs";
import Ajv from "ajv";
const ajv = new Ajv({ strict: false, allErrors: true }),
  check = ajv.compile(
    await readJSON(new URL("../../schemas/brief.schema.json", import.meta.url)),
  );
export function validateBrief(brief) {
  if (!check(brief)) fail(ajv.errorsText(check.errors));
  return brief;
}
