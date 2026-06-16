import type { CodegenConfig } from "./codegen";
import type { Finding, LoadedArea } from "./types";

export function checkBindings(loaded: LoadedArea[], config: CodegenConfig): Finding[] {
  const findings: Finding[] = [];
  for (const { file, area } of loaded) {
    for (const feature of area?.features ?? []) {
      const binding = feature.binding;
      if (!binding) continue;
      if (!config.specs[binding.spec]) {
        findings.push({
          level: "error",
          file,
          message: `feature "${feature.id}" binds to unknown spec "${binding.spec}" (not declared in codegen config)`,
        });
      }
    }
  }
  return findings;
}
