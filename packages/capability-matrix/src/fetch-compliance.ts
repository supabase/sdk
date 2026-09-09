export async function fetchComplianceFile(
  slug: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.raw+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `https://api.github.com/repos/${slug}/contents/sdk-compliance.yaml`;
  const res = await fetchImpl(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${slug}`);
  return res.text();
}
