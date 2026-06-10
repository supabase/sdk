import type { Finding, LoadedArea } from "./types.js";

export interface RepoClient {
  getFile(repo: string, path: string, ref?: string): Promise<string | null>;
}

// Source-code references were removed from capability YAML in the SDK compliance redesign.
// Compliance files (supabase-capabilities.yaml in each SDK repo) carry status only.
export async function checkReferences(
  _loaded: LoadedArea[],
  _client: RepoClient
): Promise<Finding[]> {
  return [];
}
