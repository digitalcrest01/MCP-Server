import { z } from "zod";
import { PaginationSchema, RepoIdentifierSchema, ResponseFormatSchema } from "./common.js";

export const ListPullRequestsInputSchema = z.object({
  ...RepoIdentifierSchema,
  state: z.enum(["open", "closed", "all"]).default("open"),
  base: z.string().min(1).max(200).optional(),
  head: z.string().min(1).max(200).optional(),
  sort: z.enum(["created", "updated", "popularity", "long-running"]).default("created"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  ...PaginationSchema,
  response_format: ResponseFormatSchema,
}).strict();
export type ListPullRequestsInput = z.infer<typeof ListPullRequestsInputSchema>;

export const GetPullRequestInputSchema = z.object({
  ...RepoIdentifierSchema,
  pull_number: z.number().int().positive(),
  response_format: ResponseFormatSchema,
}).strict();
export type GetPullRequestInput = z.infer<typeof GetPullRequestInputSchema>;
