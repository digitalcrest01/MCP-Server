import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetRepoInputSchema, ListRepoContentsInputSchema, type GetRepoInput, type ListRepoContentsInput } from "../schemas/repos.js";
import { getGitHubClient } from "../services/github_client.js";
import { handleApiError } from "../services/error_handler.js";
import { errorResult, formatResult, formatTimestamp, type ToolResult } from "../services/formatter.js";

async function getRepoHandler(params: GetRepoInput): Promise<ToolResult> {
  try {
    const gh = getGitHubClient();
    const { data } = await gh.repos.get({ owner: params.owner, repo: params.repo });
    const structured = {
      id: data.id, full_name: data.full_name, description: data.description,
      private: data.private, fork: data.fork, default_branch: data.default_branch,
      language: data.language, stars: data.stargazers_count, watchers: data.subscribers_count,
      forks: data.forks_count, open_issues: data.open_issues_count, topics: data.topics ?? [],
      license: data.license?.spdx_id ?? null, archived: data.archived,
      created_at: data.created_at, updated_at: data.updated_at, pushed_at: data.pushed_at,
      html_url: data.html_url,
    };
    const md = `# ${data.full_name}\n\n${data.description ?? "_No description_"}\n\n- **Default branch**: ${data.default_branch}\n- **Language**: ${data.language ?? "n/a"}\n- **Stars**: ${data.stargazers_count}\n- **Forks**: ${data.forks_count}\n- **Open issues**: ${data.open_issues_count}\n- **License**: ${data.license?.spdx_id ?? "none"}\n- **Topics**: ${(data.topics ?? []).join(", ") || "_none_"}\n- **Archived**: ${data.archived ? "yes" : "no"}\n- **Created**: ${formatTimestamp(data.created_at)}\n- **Last pushed**: ${formatTimestamp(data.pushed_at)}\n- **URL**: ${data.html_url}\n`;
    return formatResult(structured, md, params.response_format, "Repo metadata is fixed-size.");
  } catch (error) { return errorResult(handleApiError(error)); }
}

async function listRepoContentsHandler(params: ListRepoContentsInput): Promise<ToolResult> {
  try {
    const gh = getGitHubClient();
    const { data } = await gh.repos.getContent({
      owner: params.owner, repo: params.repo, path: params.path,
      ...(params.ref ? { ref: params.ref } : {}),
    });
    const entries = Array.isArray(data) ? data : [data];
    const items = entries.map((e) => ({
      type: e.type, name: e.name, path: e.path, size: e.size, sha: e.sha, html_url: e.html_url,
      ...(e.type === "file" && "download_url" in e && e.download_url ? { download_url: e.download_url } : {}),
    }));
    const structured = { owner: params.owner, repo: params.repo, path: params.path, ref: params.ref ?? null, count: items.length, entries: items };
    const lines: string[] = [
      `# Contents of ${params.owner}/${params.repo}${params.path ? "/" + params.path : ""}`, "",
      params.ref ? `Ref: \`${params.ref}\`` : "Ref: _default branch_", "",
    ];
    for (const e of items) {
      const sizeStr = e.type === "file" ? ` (${e.size} bytes)` : "";
      lines.push(`- **${e.type}**: \`${e.name}\`${sizeStr}`);
    }
    return formatResult(structured, lines.join("\n"), params.response_format, "Drill into a subdirectory with the 'path' parameter.");
  } catch (error) { return errorResult(handleApiError(error)); }
}

export function registerRepoTools(server: McpServer): void {
  server.registerTool("github_get_repo", {
    title: "Get GitHub Repository",
    description: "Fetch metadata for a single GitHub repository.\n\nArgs: owner (string), repo (string), response_format ('markdown' | 'json', default 'markdown').\n\nReturns: { id, full_name, description, private, fork, default_branch, language, stars, watchers, forks, open_issues, topics[], license, archived, created_at, updated_at, pushed_at, html_url }.\n\nExamples:\n  - 'What is the default branch of anthropics/claude-code?'\n  - 'How many open issues does facebook/react have?'\n\nError handling: 404 if owner/repo do not exist or are private and your token lacks access.",
    inputSchema: GetRepoInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (args) => getRepoHandler(GetRepoInputSchema.parse(args)));

  server.registerTool("github_list_repo_contents", {
    title: "List GitHub Repository Contents",
    description: "List files and directories at a path within a GitHub repo.\n\nArgs: owner (string), repo (string), path (string, default ''), ref (string, optional), response_format ('markdown' | 'json').\n\nReturns: { owner, repo, path, ref, count, entries[] }. Each entry has type ('file' | 'dir' | 'submodule' | 'symlink'), name, path, size, sha, html_url, and download_url for files.\n\nExamples:\n  - 'List the src directory of anthropics/anthropic-sdk-typescript'\n  - 'Show the files at the root of microsoft/typescript on branch release-5.4'\n\nError handling: 404 if path or ref does not exist.",
    inputSchema: ListRepoContentsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (args) => listRepoContentsHandler(ListRepoContentsInputSchema.parse(args)));
}
