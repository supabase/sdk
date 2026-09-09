import { describe, expect, it, vi } from "vitest";
import { fetchComplianceFile } from "../src/fetch-compliance";

describe("fetchComplianceFile", () => {
  it("does not send an empty bearer token when aggregating public compliance files", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("sdk: javascript", { status: 200 }));

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
    const fetchImpl = vi.fn().mockResolvedValue(new Response("sdk: javascript", { status: 200 }));

    await fetchComplianceFile("supabase/supabase-js", "token", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });
});
