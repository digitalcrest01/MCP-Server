import { z } from "zod";
import { PaginationSchema, ResponseFormatSchema } from "./common.js";

export const SearchCodeInputSchema = z.object({
  query: z.string().min(1).max(256),
  sort: z.enum(["indexed", "best-match"]).default("best-match"),
  order: z.enum(["asc", "desc"]).default("desc"),
  ...PaginationSchema,
  response_format: ResponseFormatSchema,
}).strict();
export type SearchCodeInput = z.infer<typeof SearchCodeInputSchema>;

export const GetUserInputSchema = z.object({
  username: z.string().min(1).max(39)
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/, "Invalid GitHub username"),
  response_format: ResponseFormatSchema,
}).strict();
export type GetUserInput = z.infer<typeof GetUserInputSchema>;
