import { loadQARefineChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ContextualCompressionRetriever } from "langchain/retrievers/contextual_compression";
import { LLMChainExtractor } from "langchain/retrievers/document_compressors/chain_extract";
import { DynamicStructuredTool } from "langchain/tools";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { Document } from "langchain/document";
import {
  FunctionalTranslator,
  SelfQueryRetriever,
} from "langchain/retrievers/self_query";
import path from "path";
import {
  AST_QUERY_DESCRIPTION,
  AST_VECTOR_STORE_SELF_QUERY_DESCRIPTION,
} from "../prompts/repo-query-tool.promp";
import { getDumbModel } from "../utils/models.util";
import { AST_SCHEMA } from "../schemas/ast.schema";

const queries: { question: string; metaData: string; answer?: string }[] = [];

export const astQueryTool = new DynamicStructuredTool({
  name: "monorepo-ast-search",
  description: AST_QUERY_DESCRIPTION,
  schema: AST_SCHEMA,
  func: async (data) => {
    const dir = path.join(process.env.STORE_FOLDER_URL, "ast");
    const vectorStore = await HNSWLib.load(dir, new OpenAIEmbeddings());
    const currentQuery: {
      question: string;
      metaData: string;
      answer?: string;
    } = { question: data.question, metaData: JSON.stringify(data) };

    const repeatedQuery = queries.find(
      (query) =>
        query.question === currentQuery.question &&
        query.metaData === currentQuery.metaData
    );
    if (repeatedQuery) {
      return `Try to change your question, You have asked this question before and here was the answer:
      ${repeatedQuery.answer}
      `;
    }
    queries.push(currentQuery);

    // get all the related docs in prep for filtering
    let docs: Document<Record<string, any>>[] = [];
    try {
      const selfQueryRetriever = SelfQueryRetriever.fromLLM({
        llm: getDumbModel(),
        vectorStore,
        documentContents: AST_VECTOR_STORE_SELF_QUERY_DESCRIPTION,
        attributeInfo: [
          {
            name: "files",
            description: "file names to narrow down the search",
            type: "string",
          },
        ],
        structuredQueryTranslator: new FunctionalTranslator(),
        verbose: true,
      });

      // self query retriever docs
      try {
        for (const file of data.files ?? []) {
          const retrievedDocs = await selfQueryRetriever.getRelevantDocuments(
            `find this file: ${file} related to this question: ${data.question}`
          );
          docs.push(...retrievedDocs);
        }
      } catch (error) {}

      // question search and AST structure search

      try {
        for (const codebaseInfo of data.codebaseInfo ?? []) {
          // self query retriever docs
          const retrievedDocs = await vectorStore.similaritySearch(
            JSON.stringify(codebaseInfo),
            200
          );
          docs.push(...retrievedDocs);
        }
      } catch (error) {}

      docs.push(
        ...(await vectorStore.similaritySearch(
          JSON.stringify(data.question),
          200
        ))
      );
    } catch (error) {}

    if (!docs.length) {
      currentQuery.answer = "No relevant documents found";
      return currentQuery.answer;
    }

    const contextualCompRetriever = (
      await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings())
    ).asRetriever();
    const baseCompressor = LLMChainExtractor.fromLLM(getDumbModel());

    const ccRetriever = new ContextualCompressionRetriever({
      baseCompressor,
      baseRetriever: contextualCompRetriever,
      verbose: true,
    });

    const ccDocs = await ccRetriever.getRelevantDocuments(data.question);
    console.log(ccDocs.length);
    const qaRefineChain = loadQARefineChain(getDumbModel(), { verbose: true });
    const res = await qaRefineChain.call({
      input_documents: ccDocs.length ? ccDocs : docs.slice(0, 15),
      question: data.question,
    });
    currentQuery.answer = res.output_text ?? "";
    return currentQuery.answer;
  },
});
