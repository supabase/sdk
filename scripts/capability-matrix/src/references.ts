import { LANGUAGES } from "./types";
import type { Finding, LoadedArea } from "./types";

export interface RepoClient {
  /** Returns file content if the path exists, or null if it does not. */
  getFile(repo: string, path: string, ref?: string): Promise<string | null>;
}

export async function checkReferences(loaded: LoadedArea[], client: RepoClient): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const { file, area } of loaded) {
    for (const feature of area.features ?? []) {
      for (const lang of LANGUAGES) {
        const entry = feature.sdks?.[lang];
        if (!entry || entry.status !== "implemented") continue;
        for (const ref of entry.references ?? []) {
          const at = ref.ref ? `@${ref.ref}` : "";
          let content: string | null;
          try {
            content = await client.getFile(ref.repo, ref.path, ref.ref);
          } catch (e) {
            findings.push({ level: "error", file, message: `${feature.id}.${lang}: error fetching ${ref.repo}/${ref.path}${at}: ${(e as Error).message}` });
            continue;
          }
          if (content === null) {
            findings.push({ level: "error", file, message: `${feature.id}.${lang}: path not found ${ref.repo}/${ref.path}${at}` });
            continue;
          }
          for (const symbol of ref.symbols ?? []) {
            if (!content.includes(symbol)) {
              findings.push({ level: "error", file, message: `${feature.id}.${lang}: symbol "${symbol}" not found in ${ref.repo}/${ref.path}${at}` });
            }
          }
        }
      }
    }
  }
  return findings;
}
