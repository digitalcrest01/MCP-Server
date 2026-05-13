# github-mcp-server

A Model Context Protocol (MCP) server that exposes GitHub repositories, issues, pull requests, code search, and users to LLM agents over **stdio**.

Built following the `mcp-builder` skill's four-phase methodology: research, implementation, review, evaluation.

## Tools

| Tool | Read-only | Idempotent | Purpose |
|---|---|---|---|
| `github_get_repo` | yes | yes | Repo metadata |
| `github_list_repo_contents` | yes | yes | File tree at a path/ref |
| `github_list_issues` | yes | yes | Issues filtered by state/labels/assignee/since |
| `github_get_issue` | yes | yes | Single issue with body |
| `github_search_issues` | yes | yes | Cross-repo issue/PR search |
| `github_create_issue` | **no** | no | Open a new issue (non-destructive write) |
| `github_list_pull_requests` | yes | yes | PRs filtered by state/base/head |
| `github_get_pull_request` | yes | yes | Single PR with mergeability and diff stats |
| `github_search_code` | yes | yes | File-content search across GitHub |
| `github_get_user` | yes | yes | User or organization profile |

All read tools support both `markdown` (default) and `json` response formats. List tools use offset-based pagination with `limit`, `offset`, `has_more`, and `next_offset`.

## Setup

```bash
npm install
npm run build
```

### Authentication

Create a [GitHub personal access token](https://github.com/settings/tokens) with the scopes you need:

- **Public read-only**: no scopes required (still recommended for higher rate limits — 5000/hr instead of 60/hr)
- **Private repos**: `repo` scope
- **Issue creation**: `repo` scope (or `public_repo` for public repos only)

Export it:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### Wiring to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/absolute/path/to/github-mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Restart Claude Desktop. The tools will appear in the integrations menu.

### Wiring to Claude Code

```bash
claude mcp add github -- node /absolute/path/to/github-mcp-server/dist/index.js
```

Set `GITHUB_TOKEN` in your shell environment beforehand.

## Local testing

Use the official MCP Inspector to drive the server interactively:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Design notes

- **stdio logging discipline**: all diagnostic output goes to `stderr`. `stdout` is reserved for JSON-RPC.
- **Token never leaves the process**: only Octokit's `Authorization` header sees it.
- **Octokit handles**: retry-on-network-error, rate-limit header parsing, conditional requests.
- **Truncation**: any response over 25 000 chars is truncated with a suggestion on how to recover (pagination or filtering).
- **No destructive operations**: `github_create_issue` is the only write tool, and it only *adds*. There are deliberately no `delete`, `close`, or `merge` tools in this v1.

## License

MIT
