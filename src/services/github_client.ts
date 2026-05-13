import { Octokit } from "@octokit/rest";

let cachedClient: Octokit | null = null;

export function getGitHubClient(): Octokit {
  if (cachedClient) return cachedClient;
  const token = process.env.GITHUB_TOKEN;
  cachedClient = new Octokit({
    auth: token ?? undefined,
    userAgent: "github-mcp-server/1.0.0",
    request: { timeout: 30_000 },
  });
  return cachedClient;
}

export function isAuthenticated(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}
