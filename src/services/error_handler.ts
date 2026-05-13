import { RequestError } from "@octokit/request-error";
import { isAuthenticated } from "./github_client.js";

export function handleApiError(error: unknown): string {
  if (error instanceof RequestError) {
    const status = error.status;
    const headers = error.response?.headers as Record<string, string | undefined> | undefined;
    const remaining = headers?.["x-ratelimit-remaining"];
    const reset = headers?.["x-ratelimit-reset"];
    switch (status) {
      case 401:
        return "Error: Authentication failed. Check that GITHUB_TOKEN is set to a valid personal access token with the required scopes.";
      case 403: {
        if (remaining === "0") {
          const resetMsg = reset ? ` Limit resets at ${new Date(Number(reset) * 1000).toISOString()}.` : "";
          const authHint = isAuthenticated() ? "" : " Set GITHUB_TOKEN to raise the limit from 60/hr to 5000/hr.";
          return `Error: GitHub rate limit exceeded.${resetMsg}${authHint}`;
        }
        return "Error: Permission denied. The token may lack required scopes or the resource may be private.";
      }
      case 404:
        return "Error: Resource not found. Verify owner, repo name, and any IDs are correct and accessible to your token.";
      case 422:
        return `Error: Request rejected as unprocessable. Common causes: invalid search query syntax, duplicate resource, or validation failure. Details: ${error.message}`;
      case 429:
        return "Error: Secondary rate limit triggered. Wait at least 60 seconds before retrying.";
      case 500:
      case 502:
      case 503:
      case 504:
        return `Error: GitHub is experiencing issues (HTTP ${status}). Try again in a few seconds.`;
      default:
        return `Error: GitHub API request failed with status ${status}: ${error.message}`;
    }
  }
  if (error instanceof Error) {
    if (error.message.includes("timeout") || error.message.includes("ECONNABORTED")) {
      return "Error: Request to GitHub timed out after 30 seconds. Try again or reduce page size.";
    }
    return `Error: ${error.message}`;
  }
  return `Error: Unexpected non-Error value thrown: ${String(error)}`;
}
