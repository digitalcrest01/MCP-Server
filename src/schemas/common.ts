import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export const ResponseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' or 'json'");

export const PaginationSchema = {
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
    .describe(`Max results (1-${MAX_PAGE_SIZE}, default ${DEFAULT_PAGE_SIZE})`),
  offset: z.number().int().min(0).default(0).describe("Results to skip (default 0)"),
};

export const RepoIdentifierSchema = {
  owner: z.string().min(1).max(39).describe("Repository owner login"),
  repo: z.string().min(1).max(100).describe("Repository name"),
};
