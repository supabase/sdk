import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { loadAreas } from "./load.js";
import { validateCompliance, normalizeCompliance, collectFeatureIds } from "./compliance.js";
import type { RawCompliance } from "./compliance.js";
import type { ComplianceMap, Language } from "./types.js";

interface Repo {
  slug: string;
  language: Language;
}

// Verify these slugs before deploying — org names may change.
const REPOS: Repo[] = [
  { slug: "supabase/supabase-js", language: "javascript" },
  { slug: "supabase/supabase-flutter", language: "flutter" },
  { slug: "supabase/supabase-py", language: "python" },
  { slug: "supabase/supabase-swift", language: "swift" },
  { slug: "supabase/postgrest-csharp", language: "csharp" },
  { slug: "supabase/postgrest-go", language: "go" },
  { slug: "supabase/supabase-kt", language: "kotlin" },
];

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

async function fetchComplianceFile(slug: string, token: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${slug}/contents/sdk-compliance.yaml`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${slug}`);
  return res.text();
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN ?? "";
  const root = repoRoot();
  const { areas } = loadAreas(join(root, "capabilities"));
  const knownIds = collectFeatureIds(areas);

  const result: Partial<Record<Language, ComplianceMap>> = {};

  for (const { slug, language } of REPOS) {
    let content: string | null;
    try {
      content = await fetchComplianceFile(slug, token);
    } catch (e) {
      console.error(`${language}: fetch failed for ${slug}: ${(e as Error).message}`);
      continue;
    }

    if (!content) {
      console.log(`${language}: no compliance file in ${slug} — treating all as not_implemented`);
      continue;
    }

    let raw: RawCompliance;
    try {
      raw = parse(content) as RawCompliance;
    } catch (e) {
      console.error(`${language}: YAML parse error in ${slug}: ${(e as Error).message}`);
      continue;
    }

    const findings = validateCompliance(raw, knownIds);
    if (findings.length > 0) {
      for (const f of findings) console.error(`${language} (${slug}): ${f.message}`);
      console.error(`${language}: skipping ${slug} due to ${findings.length} error(s)`);
      continue;
    }

    result[language] = normalizeCompliance(raw);
    console.log(`${language}: ${Object.keys(result[language]!).length} features loaded from ${slug}`);
  }

  const outDir = join(root, "site");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "compliance.json");
  writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
  console.log(`Compliance data written to site/compliance.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
