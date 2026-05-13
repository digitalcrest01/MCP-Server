import { z } from "zod";
import { RepoIdentifierSchema, ResponseFormatSchema } from "./common.js";

export const GetRepoInputSchema = z.object({
  ...RepoIdentifierSchema,
  response_format: ResponseFormatSchema,
}).strict();
export type GetRepoInput = z.infer<typeof GetRepoInputSchema>;

export const ListRepoContentsInputSchema = z.object({
  ...RepoIdentifierSchema,
  path: z.string().max(500).default("").describe("Path within repo, '' for root"),
  ref: z.string().min(1).max(200).optional().describe("Branch, tag, or SHA"),
  response_format: ResponseFormatSchema,
}).strict();
export type ListRepoContentsInput = z.infer<typeof ListRepoContentsInputSchema>;
