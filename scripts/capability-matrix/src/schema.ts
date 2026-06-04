import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { Finding, LoadedArea } from "./types";

export function compileSchema(schema: object) {
  const ajv = new Ajv2020({ allErrors: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

export function checkSchema(loaded: LoadedArea[], schema: object): Finding[] {
  const validate = compileSchema(schema);
  const findings: Finding[] = [];
  for (const { file, area } of loaded) {
    if (!validate(area)) {
      for (const err of validate.errors ?? []) {
        const where = err.instancePath || "/";
        findings.push({ level: "error", file, message: `schema: ${where} ${err.message ?? "invalid"}` });
      }
    }
  }
  return findings;
}
