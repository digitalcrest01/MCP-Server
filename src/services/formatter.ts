import { CHARACTER_LIMIT } from "../constants.js";
import { ResponseFormat } from "../schemas/common.js";
import type { PaginatedResponse } from "../types.js";

export interface ToolContentBlock {
  type: "text";
  text: string;
}

export interface ToolResult {
  [x: string]: unknown;
  content: ToolContentBlock[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export function truncateIfNeeded(text: string, suggestion: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return text.slice(0, CHARACTER_LIMIT) + `\n\n[TRUNCATED] Response exceeded ${CHARACTER_LIMIT} characters. ${suggestion}`;
}

export function buildPaginatedResponse<T>(
  pageItems: T[],
  offset: number,
  limit: number,
  total: number | null,
  fetchedPageSize: number
): PaginatedResponse<T> {
  const hasMore =
    total !== null
      ? offset + pageItems.length < total
      : fetchedPageSize >= limit && pageItems.length >= limit;
  return {
    total,
    count: pageItems.length,
    offset,
    items: pageItems,
    has_more: hasMore,
    ...(hasMore ? { next_offset: offset + pageItems.length } : {}),
  };
}

export function formatResult(
  structured: Record<string, unknown>,
  markdown: string,
  format: ResponseFormat,
  truncationSuggestion: string
): ToolResult {
  const text =
    format === ResponseFormat.MARKDOWN
      ? truncateIfNeeded(markdown, truncationSuggestion)
      : truncateIfNeeded(JSON.stringify(structured, null, 2), truncationSuggestion);
  return { content: [{ type: "text", text }], structuredContent: structured };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function offsetToPage(offset: number, limit: number): { page: number; per_page: number } {
  return { page: Math.floor(offset / limit) + 1, per_page: limit };
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}
