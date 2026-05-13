import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetUserInputSchema, SearchCodeInputSchema, type GetUserInput, type SearchCodeInput } from "../schemas/search.js";
import { getGitHubClient } from "../services/github_client.js";
import { handleApiError } from "../services/error_handler.js";
import { buildPaginatedResponse, errorResult, formatResult, formatTimestamp, offsetToPage, type ToolResult } from "../services/formatter.js";

interface CodeHit { name: string; path: string; sha: string; repository: string; html_url: string; score: number; }

async function searchCodeHandler(params: SearchCodeInput): Promise<ToolResult> {
  try {
    const gh = getGitHubClient();
    const { page, per_page } = offsetToPage(params.offset, params.limit);
    const sortParam = params.sort === "best-match" ? undefined : params.sort;
    const { data } = await gh.search.code({ q: params.query, ...(sortParam ? { sort: sortParam } : {}), order: params.order, page, per_page });
    const items: CodeHit[] = data.items.map((it) => ({
      name: it.name, path: it.path, sha: it.sha,
      repository: it.repository.full_name, html_url: it.html_url, score: it.score,
    }));
    const envelope = buildPaginatedResponse<CodeHit>(items, params.offset, params.limit, data.total_count, data.items.length);
    const lines: string[] = [
      `# Code search: \`${params.query}\``, "",
      `${data.total_count} match${data.total_count === 1 ? "" : "es"} total. Showing ${envelope.count} starting at offset ${envelope.offset}.`, "",
    ];
    for (const hit of items) {
      lines.push(`## ${hit.repository} - \`${hit.path}\``);
      lines.push(`- **File**: ${hit.name}`);
      lines.push(`- **SHA**: \`${hit.sha.slice(0, 10)}\``);
      lines.push(`- **URL**: ${hit.html_url}`);
      lines.push("");
    }
    return formatResult(envelope as unknown as Record<string, unknown>, lines.join("\n"), params.response_format, "Narrow with 'repo:', 'language:', 'path:', 'extension:', or increase offset.");
  } catch (error) { return errorResult(handleApiError(error)); }
}

async function getUserHandler(params: GetUserInput): Promise<ToolResult> {
  try {
    const gh = getGitHubClient();
    const { data } = await gh.users.getByUsername({ username: params.username });
    const structured = {
      id: data.id, login: data.login, type: data.type, name: data.name,
      company: data.company, blog: data.blog, location: data.location,
      email: data.email, bio: data.bio, twitter_username: data.twitter_username,
      public_repos: data.public_repos, public_gists: data.public_gists,
      followers: data.followers, following: data.following,
      created_at: data.created_at, updated_at: data.updated_at, html_url: data.html_url,
    };
    const md = `# ${data.login}${data.name ? ` (${data.name})` : ""}\n\n- **Type**: ${data.type}\n` +
      (data.bio ? `- **Bio**: ${data.bio}\n` : "") +
      (data.company ? `- **Company**: ${data.company}\n` : "") +
      (data.location ? `- **Location**: ${data.location}\n` : "") +
      (data.blog ? `- **Blog**: ${data.blog}\n` : "") +
      `- **Public repos**: ${data.public_repos}\n- **Followers**: ${data.followers}\n- **Following**: ${data.following}\n- **Joined**: ${formatTimestamp(data.created_at)}\n- **URL**: ${data.html_url}\n`;
    return formatResult(structured as unknown as Record<string, unknown>, md, params.response_format, "User profile is fixed-size.");
  } catch (error) { return errorResult(handleApiError(error)); }
}

export function registerSearchAndUserTools(server: McpServer): void {
  server.registerTool("github_search_code", {
    title: "Search GitHub Code",
    description: "Search file contents across GitHub.\n\nArgs: query (with qualifiers like 'repo:', 'language:', 'path:', 'extension:', 'filename:'), sort ('indexed'|'best-match', default 'best-match'), order, limit, offset, response_format.\n\nReturns: paginated envelope with total_count. Each item: { name, path, sha, repository, html_url, score }.\n\nError handling: 422 if query is malformed (GitHub requires at least one search term). 403 on the strict 30 req/min code-search rate limit.",
    inputSchema: SearchCodeInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (args) => searchCodeHandler(SearchCodeInputSchema.parse(args)));

  server.registerTool("github_get_user", {
    title: "Get GitHub User",
    description: "Fetch a public user or organization profile by login.\n\nArgs: username (1-39 chars), response_format.\n\nReturns: { id, login, type ('User'|'Organization'), name, company, blog, location, email, bio, twitter_username, public_repos, public_gists, followers, following, created_at, updated_at, html_url }.\n\nError handling: 404 if the username does not exist.",
    inputSchema: GetUserInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (args) => getUserHandler(GetUserInputSchema.parse(args)));
}
