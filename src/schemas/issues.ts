import { z } from "zod";
import { PaginationSchema, RepoIdentifierSchema, ResponseFormatSchema } from "./common.js";

export const ListIssuesInputSchema = z.object({
  ...RepoIdentifierSchema,
  state: z.enum(["open", "closed", "all"]).default("open"),
  labels: z.array(z.string().min(1).max(50)).max(10).optional(),
  assignee: z.string().min(1).max(39).optional(),
  since: z.string().datetime().optional(),
  ...PaginationSchema,
  response_format: ResponseFormatSchema,
}).strict();
export type ListIssuesInput = z.infer<typeof ListIssuesInputSchema>;

export const GetIssueInputSchema = z.object({
  ...RepoIdentifierSchema,
  issue_number: z.number().int().positive(),
  response_format: ResponseFormatSchema,
}).strict();
export type GetIssueInput = z.infer<typeof GetIssueInputSchema>;

export const SearchIssuesInputSchema = z.object({
  query: z.string().min(1).max(256),
  sort: z.enum(["created", "updated", "comments", "reactions", "best-match"]).default("best-match"),
  order: z.enum(["asc", "desc"]).default("desc"),
  ...PaginationSchema,
  response_format: ResponseFormatSchema,
}).strict();
export type SearchIssuesInput = z.infer<typeof SearchIssuesInputSchema>;

export const CreateIssueInputSchema = z.object({
  ...RepoIdentifierSchema,
  title: z.string().min(1).max(256),
  body: z.string().max(65536).optional(),
  labels: z.array(z.string().min(1).max(50)).max(20).optional(),
  assignees: z.array(z.string().min(1).max(39)).max(10).optional(),
}).strict();
export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;
