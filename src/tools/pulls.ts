import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPullRequestInputSchema, ListPullRequestsInputSchema, type GetPullRequestInput, type ListPullRequestsInput } from "../schemas/pulls.js";
import { getGitHubClient } from "../services/github_client.js";
import { handleApiError } from "../services/error_handler.js";
import { buildPaginatedResponse, errorResult, formatResult, formatTimestamp, offsetToPage, type ToolResult } from "../services/formatter.js";

interface PullSummary {
  number: number; title: string; state: string; draft: boolean;
  user: string | null; base: string; head: string;
  labels: string[]; requested_reviewers: string[]; comments: number;
  created_at: string | null; updated_at: string | null;
  closed_at: string | null; merged_at: string | null; html_url: string;
}

interface PullLike {
  number: number; title: string; state: string; draft?: boolean;
  user: { login: string } | null;
  base: { ref: string }; head: { ref: string };
  labels: Array<{ name?: string }>;
  requested_reviewers?: Array<{ login: string }> | null;
  comments?: number;
  created_at: string | null; updated_at: string | null;
  closed_at: string | null; merged_at: string | null; html_url: string;
}

function summarisePull(p: PullLike): PullSummary {
  return {
    number: p.number, title: p.title, state: p.state, draft: Boolean(p.draft),
    user: p.user?.login ?? null, base: p.base.ref, head: p.head.ref,
    labels: (p.labels ?? []).map((l) => l.name ?? "").filter((s) => s.length > 0),
    requested_reviewers: (p.requested_reviewers ?? []).map((r) => r.login),
    comments: p.comments ?? 0,
    created_at: p.created_at, updated_at: p.updated_at,
    closed_at: p.closed_at, merged_at: p.merged_at, html_url: p.html_url,
  };
}

async function listPullRequestsHandler(params: ListPullRequestsInput): Promise<ToolResult> {
  try {
    const gh = getGitHubClient();
    const { page, per_page } = offsetToPage(params.offset, params.limit);
    const { data } = await gh.pulls.list({
      owner: params.owner, repo: params.repo, state: params.state,
      ...(params.base ? { base: params.base } : {}),
      ...(params.head ? { head: params.head } : {}),
      sort: params.sort, direction: params.direction, page, per_page,
    });
    const items = data.map((p) => summarisePull(p as unknown as PullLike));
    const envelope = buildPaginatedResponse<PullSummary>(items, params.offset, params.limit, null, data.length);
    const lines: string[] = [
      `# Pull requests in ${params.owner}/${params.repo} (state=${params.state})`, "",
      `Showing ${envelope.count} (offset=${envelope.offset}).` + (envelope.has_more ? " More available." : ""), "",
    ];
    for (const p of items) {
      lines.push(`## PR #${p.number}: ${p.title}${p.draft ? " (draft)" : ""}`);
      lines.push(`- **State**: ${p.state}${p.merged_at ? " (merged)" : ""}`);
      lines.push(`- **Author**: ${p.user ?? "unknown"}`);
      lines.push(`- **Branch**: \`${p.head}\` -> \`${p.base}\``);
      if (p.labels.length) lines.push(`- **Labels**: ${p.labels.join(", ")}`);
      if (p.requested_reviewers.length) lines.push(`- **Reviewers**: ${p.requested_reviewers.join(", ")}`);
      lines.push(`- **Updated**: ${formatTimestamp(p.updated_at)}`);
      lines.push(`- **URL**: ${p.html_url}`);
      lines.push("");
    }
    return formatResult(envelope as unknown as Record<string, unknown>, lines.join("\n"), params.response_format, "Increase offset or apply base/head filters.");
  } catch (error) { return errorResult(handleApiError(error)); }
}

async function getPullRequestHandler(params: GetPullRequestInput): Promise<ToolResult> {
  try {
    const gh = getGitHubClient();
    const { data } = await gh.pulls.get({ owner: params.owner, repo: params.repo, pull_number: params.pull_number });
    const summary = summarisePull(data as unknown as PullLike);
    const structured = {
      ...summary, body: data.body ?? "",
      mergeable: data.mergeable, mergeable_state: data.mergeable_state,
      additions: data.additions, deletions: data.deletions,
      changed_files: data.changed_files, commits: data.commits,
      merged: data.merged, merged_by: data.merged_by?.login ?? null,
    };
    const md = `# PR #${data.number}: ${data.title}${data.draft ? " (draft)" : ""}\n\n- **State**: ${data.state}${data.merged ? " (merged)" : ""}\n- **Author**: ${data.user?.login ?? "unknown"}\n- **Branch**: \`${summary.head}\` -> \`${summary.base}\`\n- **Mergeable**: ${data.mergeable === null ? "computing" : data.mergeable} (${data.mergeable_state})\n- **Stats**: +${data.additions} / -${data.deletions} across ${data.changed_files} files, ${data.commits} commit(s)\n` +
      (summary.labels.length ? `- **Labels**: ${summary.labels.join(", ")}\n` : "") +
      (summary.requested_reviewers.length ? `- **Reviewers**: ${summary.requested_reviewers.join(", ")}\n` : "") +
      `- **Created**: ${formatTimestamp(data.created_at)}\n- **Updated**: ${formatTimestamp(data.updated_at)}\n` +
      (data.merged_at ? `- **Merged**: ${formatTimestamp(data.merged_at)} by ${structured.merged_by ?? "unknown"}\n` : "") +
      `- **URL**: ${data.html_url}\n\n## Body\n\n${data.body ?? "_No body_"}\n`;
    return formatResult(structured as unknown as Record<string, unknown>, md, params.response_format, "PR body too long; switch to response_format='json'.");
  } catch (error) { return errorResult(handleApiError(error)); }
}

export function registerPullRequestTools(server: McpServer): void {
  server.registerTool("github_list_pull_requests", {
    title: "List GitHub Pull Requests",
    description: "List pull requests in a repository.\n\nArgs: owner, repo, state ('open'|'closed'|'all', default 'open'; 'closed' includes merged), base, head, sort ('created'|'updated'|'popularity'|'long-running', default 'created'), direction, limit, offset, response_format.\n\nReturns: paginated envelope. Each item: { number, title, state, draft, user, base, head, labels[], requested_reviewers[], comments, created_at, updated_at, closed_at, merged_at, html_url }.",
    inputSchema: ListPullRequestsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (args) => listPullRequestsHandler(ListPullRequestsInputSchema.parse(args)));

  server.registerTool("github_get_pull_request", {
    title: "Get GitHub Pull Request",
    description: "Fetch a single PR with body, mergeability, diff stats, reviewers.\n\nArgs: owner, repo, pull_number (positive int), response_format.\n\nReturns: full PR summary plus body, mergeable, mergeable_state, additions, deletions, changed_files, commits, merged, merged_by.",
    inputSchema: GetPullRequestInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (args) => getPullRequestHandler(GetPullRequestInputSchema.parse(args)));
}
