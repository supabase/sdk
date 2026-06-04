import { Octokit } from "@octokit/rest";
import type { RepoClient } from "./references";

export interface GetContentResult {
  data: unknown;
}
export type GetContent = (params: {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}) => Promise<GetContentResult>;

export function makeRepoClient(getContent: GetContent): RepoClient {
  return {
    async getFile(repo, path, ref) {
      const [owner, name] = repo.split("/");
      try {
        const res = await getContent({ owner, repo: name, path, ref });
        const data = res.data as { content?: string; encoding?: string };
        if (data.content && data.encoding === "base64") {
          return Buffer.from(data.content, "base64").toString("utf8");
        }
        // Path exists (e.g. a directory) but has no decodable content.
        return "";
      } catch (e) {
        if ((e as { status?: number }).status === 404) return null;
        throw e;
      }
    },
  };
}

export function githubClient(token?: string): RepoClient {
  const octokit = new Octokit(token ? { auth: token } : {});
  return makeRepoClient((params) => octokit.repos.getContent(params));
}
