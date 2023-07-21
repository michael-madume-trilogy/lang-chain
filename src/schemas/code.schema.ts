import { z } from "zod";

export const CODE_QUERY_SCHEMA = z
  .object({
    question: z
      .string()
      .describe("A query you have about the actual code in your repository"),
    files: z
      .array(z.string())
      .optional()
      .describe(
        "An array of FULL file paths. (skip it if you don't know the exact relative path you want to search for)"
      ),
    codebaseInfo: z
      .array(
        z.object({
          fileName: z
            .string()
            .optional()
            .describe("The name of the file being queried."),
          imports: z
            .array(z.string())
            .optional()
            .describe("The imported modules in the file."),
          functions: z
            .array(z.string())
            .optional()
            .describe("An array of function names in the file."),
          classes: z
            .array(z.string())
            .optional()
            .describe("An array of class names in the file."),
          interfaces: z
            .array(z.string())
            .optional()
            .describe("An array of interface names in the file."),
          tags: z
            .array(z.string())
            .optional()
            .describe("An array of HTML tag names in the file."),
          json: z
            .unknown()
            .optional()
            .describe("Any other data related to the file."),
        })
      )
      .optional()
      .describe("An array of information about each file."),
  })
  .describe(
    "The schema for querying actual code in your codebase. This tool leverages information from the AST Vector Store to enhance results. Your query, along with optional file path details, guides the search."
  );
