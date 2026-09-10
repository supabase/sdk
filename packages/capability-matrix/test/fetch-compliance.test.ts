import { describe, it, expect, vi } from "vitest";
import { fetchComplianceFile } from "../src/fetch-compliance";

function respondWith(body: BodyInit | null, init?: ResponseInit) {
  return vi.fn().mockResolvedValue(new Response(body, init));
}

describe("fetchComplianceFile", () => {
  it("does not send an empty bearer token when aggregating public compliance files", async () => {
    const fetchImpl = respondWith("sdk: javascript", { status: 200 });

    await expect(fetchComplianceFile("supabase/supabase-js", "", fetchImpl)).resolves.toBe(
      "sdk: javascript",
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/supabase/supabase-js/contents/sdk-compliance.yaml",
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      }),
    );
  });

  it("uses the supplied token when one is available", async () => {
    const fetchImpl = respondWith("sdk: javascript", { status: 200 });

    await fetchComplianceFile("supabase/supabase-js", "token", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("treats a whitespace-only token as anonymous", async () => {
    const fetchImpl = respondWith("sdk: javascript", { status: 200 });

    await fetchComplianceFile("supabase/supabase-js", "  ", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      }),
    );
  });

  it("returns null when the repo has no compliance file", async () => {
    const fetchImpl = respondWith("Not Found", { status: 404 });

    await expect(fetchComplianceFile("supabase/supabase-go", "", fetchImpl)).resolves.toBeNull();
  });

  it("explains how to authenticate when the anonymous rate limit is exhausted", async () => {
    const fetchImpl = respondWith("rate limited", {
      status: 403,
      headers: { "x-ratelimit-remaining": "0" },
    });

    await expect(fetchComplianceFile("supabase/supabase-js", "", fetchImpl)).rejects.toThrow(
      /rate limit exhausted for supabase\/supabase-js.*GITHUB_TOKEN/s,
    );
  });

  it("reports the status for other failures", async () => {
    const fetchImpl = respondWith("no access", {
      status: 403,
      headers: { "x-ratelimit-remaining": "58" },
    });

    await expect(fetchComplianceFile("supabase/supabase-js", "token", fetchImpl)).rejects.toThrow(
      "GitHub API 403 for supabase/supabase-js",
    );
  });
});
