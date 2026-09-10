export async function fetchComplianceFile(
  slug: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.raw+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const trimmedToken = token.trim();
  if (trimmedToken) {
    headers.Authorization = `Bearer ${trimmedToken}`;
  }

  const url = `https://api.github.com/repos/${slug}/contents/sdk-compliance.yaml`;
  const response = await fetchImpl(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return null;
  if (isRateLimited(response)) {
    throw new Error(
      `GitHub API rate limit exhausted for ${slug}. Anonymous requests are limited to 60 per hour per IP address; retry with GITHUB_TOKEN=$(gh auth token) npm run aggregate`,
    );
  }
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${slug}`);
  return response.text();
}

function isRateLimited(response: Response): boolean {
  if (response.status !== 403 && response.status !== 429) return false;
  return response.headers.get("x-ratelimit-remaining") === "0";
}
