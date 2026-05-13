#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerRepoTools } from "./tools/repos.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerPullRequestTools } from "./tools/pulls.js";
import { registerSearchAndUserTools } from "./tools/search.js";
import { isAuthenticated } from "./services/github_client.js";

async function main(): Promise<void> {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerRepoTools(server);
  registerIssueTools(server);
  registerPullRequestTools(server);
  registerSearchAndUserTools(server);

  if (!isAuthenticated()) {
    process.stderr.write(`[${SERVER_NAME}] WARNING: GITHUB_TOKEN is not set. Unauthenticated requests are limited to 60/hour. Set GITHUB_TOKEN for full functionality.\n`);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[${SERVER_NAME}] v${SERVER_VERSION} listening on stdio.\n`);
}

main().catch((err) => {
  process.stderr.write(`[${SERVER_NAME}] FATAL: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
