import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreateIssueInputSchema, GetIssueInputSchema, ListIssuesInputSchema, SearchIssuesInputSchema, type CreateIssueInput, type GetIssueInput, type ListIssuesInput, type SearchIssuesInput } from "../schemas/issues.js";
import { ResponseFormat } from "../schemas/common.js";
import { getGitHubClient } from "../services/github_client.js";
import { handleApiError } from "../services/error_handler.js";
import { buildPaginatedResponse, errorResult, formatResult, formatTimestamp, offsetToPage, type ToolResult } from "../services/formatter.js";

interface IssueSummary {
  number: number; title: string; state: string; user: string | null;
  labels: string[]; assignees: string[]; comments: number;
  created_at: string | null; updated_at: string | null; closed_at: string | null;
  html_url: string; is_pull_request: boolean;
}

interface IssueLike {
  number: number; title: string; state: string;
  user: { login: string } | null;
  labels: Array<string | { name?: string }>;
  assignees?: Array<{ login: string }> | null;
  comments: number;
  created_at: string | null; updated_at: string | null; closed_at: string | null;
  html_url: string; pull_request?: unknown;
}

function summariseIssue(i: IssueLike): IssueSummary {
  return {
    number: i.number, title: i.title, state: i.state, user: i.user?.login ?? null,
    labels: (i.labels ?? []).map((l) => (typeof l === "string" ? l : l.name ?? "")).filter((s) => s.length > 0),
    assignees: (i.assignees ?? []).map((a) => a.login),
    comments: i.comments, created_at: i.created_at, updated_at: i.updated_at,
    closed_at: i.closed_at, html_url: i.html_url, is_pull_request: Boolean(i.pull_request),
  };
}

function renderIssueList(title: string, items: IssueSummary[], pagination: { offset: number; count: number; total: number | null; has_more: boolean }): string {
  const lines: string[] = [
    `# ${title}`, "",
    `Showing ${pagination.count} item${pagination.count === 1 ? "" : "s"} starting at offset ${pagination.offset}` +
      (pagination.total !== null ? ` of ${pagination.total} total.` : ".") +
      (pagination.has_more ? " More results available." : ""),
    "",
  ];
  for (const i of items) {
    const prefix = i.is_pull_request ? "PR" : "Issue";
    lines.push(`## ${prefix} #${i.number}: ${i.title}`);
    lines.push(`- **State**: ${i.state}`);
    if (i.user) lines.push(`- **Author**: ${i.user}`);
    if (i.labels.length) lines.push(`- **Labels**: ${i.labels.join(", ")}`);
    if (i.assignees.length) lines.push(`- **Assignees**: ${i.assignees.join(", ")}`);
    lines.push(`- **Comments**: ${i.comments}`);
    lines.push(`- **Updated**: ${formatTimestamp(i.updated_at)}`);
    lines.push(`- **URL**: ${i.html_url}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function listIssuesHandler(params: ListIssuesInput): Promise<ToolResult> {
  try {
    const gh = getGitHubClient();
    const { page, per_page } = offsetToPage(params.offset, params.limit);
    const { data } = await gh.issues.listForRepo({
      owner: params.owner, repo: params.repo, state: params.state,
      ...(params.labels ? { labels: params.labels.join(",") } : {}),
      ...(params.assignee ? { assignee: params.assignee } : {}),
      ...(params.since ? { since: params.since } : {}),
      page, per_page,
    });
    const items = data.map((d) => summariseIssue(d as unknown as IssueLike));
    const envelope = buildPaginatedResponse<IssueSummary>(items, params.offset, params.limit, null, data.length);
    return formatResult(envelope as unknown as Record<string, unknown>,
      renderIssueList(`Issues in ${params.owner}/${params.repo} (state=${params.state})`, items, envelope),
      params.response_format, "Increase offset by next_offset, or apply labels/state/since to narrow.");
  } catch (error) { return errorResult(handleApiError(error)); }
}

async function getIssueHandler(params: GetIssueInput): Promise<ToolResult> {
  try {
    const gh = getGitHubClient();
    const { data } = await gh.issues.get({ owner: params.owner, repo: params.repo, issue_number: params.issue_number });
    const summary = summariseIssue(data as unknown as IssueLike);
    const structured = { ...summary, body: data.body ?? "" };
    const md = `# ${summary.is_pull_request ? "PR" : "Issue"} #${data.number}: ${data.title}\n\n- **State**: ${data.state}\n- **Author**: ${data.user?.login ?? "unknown"}\n` +
      (summary.labels.length ? `- **Labels**: ${summary.labels.join(", ")}\n` : "") +
      (summary.assignees.length ? `- **Assignees**: ${summary.assignees.join(", ")}\n` : "") +
      `- **Comments**: ${data.comments}\n- **Created**: ${formatTimestamp(data.created_at)}\n- **Updated**: ${formatTimestamp(data.updated_at)}\n` +
      (data.closed_at ? `- **Closed**: ${formatTimestamp(data.closed_at)}\n` : "") +
      `- **URL**: ${data.html_url}\n\n## Body\n\n${data.body ?? "_No body_"}\n`;
    return formatResult(structured as unknown as Record<string, unknown>, md, params.response_format, "Issue body too long; switch to response_format='json'.");
  } catch (error) { return errorResult(handleApiError(error)); }
}

async function searchIssuesHandler(params: SearchIssuesInput): Promise<ToolResult> {
  try {
    const gh = getGitHubClient();
    const { page, per_page } = offsetToPage(params.offset, params.limit);
    const sortParam = params.sort === "best-match" ? undefined : params.sort;
    const { data } = await gh.search.issuesAndPullRequests({
      q: params.query, ...(sortParam ? { sort: sortParam } : {}), order: params.order, page, per_page,
    });
    const items = data.items.map((d) => summariseIssue(d as unknown as IssueLike));
    const envelope = buildPaginatedResponse<IssueSummary>(items, params.offset, params.limit, data.total_count, data.items.length);
    return formatResult(envelope as unknown as Record<string, unknown>,
      renderIssueList(`Issue search: \`${params.query}\``, items, envelope),
      params.response_format, "Narrow with 'repo:', 'is:open', 'label:', or increase offset.");
  } catch (error) { return errorResult(handleApiError(error)); }
}

async function createIssueHandler(params: CreateIssueInput): Promise<ToolResult> {
  try {
    const gh = getGitHubClient();
    const { data } = await gh.issues.create({
      owner: params.owner, repo: params.repo, title: params.title,
      ...(params.body ? { body: params.body } : {}),
      ...(params.labels ? { labels: params.labels } : {}),
      ...(params.assignees ? { assignees: params.assignees } : {}),
    });
    const summary = summariseIssue(data as unknown as IssueLike);
    const structured = { created: true, ...summary };
    const md = `# Created Issue #${data.number} in ${params.owner}/${params.repo}\n\n- **Title**: ${data.title}\n- **URL**: ${data.html_url}\n- **State**: ${data.state}\n` +
      (summary.labels.length ? `- **Labels**: ${summary.labels.join(", ")}\n` : "") +
      (summary.assignees.length ? `- **Assignees**: ${summary.assignees.join(", ")}\n` : "");
    return formatResult(structured as unknown as Record<string, unknown>, md, ResponseFormat.MARKDOWN, "Response is small.");
  } catch (error) { return errorResult(handleApiError(error)); }
}

export function registerIssueTools(server: McpServer): void {
  server.registerTool("github_list_issues", {
    title: "List GitHub Issues",
    description: "List issues (and PRs, flagged is_pull_request=true) in a repository.\n\nArgs: owner, repo, state ('open'|'closed'|'all', default 'open'), labels (string[]), assignee (string|'*'|'none'), since (ISO 8601), limit (1-100, default 30), offset (default 0), response_format.\n\nReturns: paginated envelope. Each item: { number, title, state, user, labels[], assignees[], comments, created_at, updated_at, closed_at, html_url, is_pull_request }.\n\nNote: GitHub's REST issues endpoint mixes issues and PRs; filter is_pull_request=false if you want issues only.",
    inputSchema: ListIssuesInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (args) => listIssuesHandler(ListIssuesInputSchema.parse(args)));

  server.registerTool("github_get_issue", {
    title: "Get GitHub Issue",
    description: "Fetch a single issue or PR by number, including its body.\n\nArgs: owner, repo, issue_number (positive int), response_format.\n\nReturns: full issue summary plus body.\n\nError handling: 404 if issue_number does not exist in the repo.",
    inputSchema: GetIssueInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (args) => getIssueHandler(GetIssueInputSchema.parse(args)));

  server.registerTool("github_search_issues", {
    title: "Search GitHub Issues",
    description: "Search issues and PRs across GitHub.\n\nArgs: query (e.g. 'repo:facebook/react is:open label:bug', 'author:torvalds is:pr'), sort ('created'|'updated'|'comments'|'reactions'|'best-match', default 'best-match'), order, limit, offset, response_format.\n\nReturns: paginated envelope with total_count. Items same shape as github_list_issues.\n\nError handling: 422 on invalid query syntax. 403 on search rate limit.",
    inputSchema: SearchIssuesInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (args) => searchIssuesHandler(SearchIssuesInputSchema.parse(args)));

  server.registerTool("github_create_issue", {
    title: "Create GitHub Issue",
    description: "Open a new issue. Non-destructive write (only adds).\n\nArgs: owner, repo, title (required, 1-256 chars), body (markdown, optional), labels (string[], must already exist on repo), assignees (string[]).\n\nReturns: { created: true, number, title, html_url, state, labels[], assignees[], ... }.\n\nError handling: 401/403 if token lacks 'issues:write'. 422 if a referenced label or assignee does not exist.",
    inputSchema: CreateIssueInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (args) => createIssueHandler(CreateIssueInputSchema.parse(args)));
}
