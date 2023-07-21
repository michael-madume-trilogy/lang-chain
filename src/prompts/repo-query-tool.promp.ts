export const AST_VECTOR_STORE_SELF_QUERY_DESCRIPTION = `
The AST vector store is your go-to for querying and understanding your codebase. It holds an abstracted form of your codebase, each document being an Abstract Syntax Tree (AST) with metadata and file names.
`;

export const SEARCH_REPEATED_ERROR = `
It appears this query has been run before without success.
`;

export const SEARCH_REPEATED_MAX_ERROR = `
You've hit a dead-end with this query. I don't have any feedback. AgentFinish
`;

export const AST_QUERY_DESCRIPTION = `
Tool for exploring an Abstract Syntax Tree (AST) Vector Store. This store holds an abstracted form of your nx-monorepo codebase, with metadata and code structure.

The results are paginated, so leverage that to get more results for the same query.
`;

export const CODE_QUERY_DESCRIPTION = `
ask questions about the code in a repo and get answers. it will also tell you when to stop searching, pay attention to that
`;

export const REPO_VECTOR_STORE_SELF_QUERY_DESCRIPTION = `
ask whatever question you get directly to this agent. do not modify

`;