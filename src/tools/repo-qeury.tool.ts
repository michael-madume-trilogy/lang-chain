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
  CODE_QUERY_DESCRIPTION,
  REPO_VECTOR_STORE_SELF_QUERY_DESCRIPTION,
} from "../prompts/repo-query-tool.promp";
import { getDumbModel, getSmartModel } from "../utils/models.util";
import { CODE_QUERY_SCHEMA } from "../schemas/code.schema";
import logger, { MyCallbackHandler } from "../utils/logger.util";

const queries: { question: string; metaData: string; answer?: string }[] = [];

export const repoQueryTool = new DynamicStructuredTool({
  name: "monorepo-qa",
  description: CODE_QUERY_DESCRIPTION,
  schema: CODE_QUERY_SCHEMA,
  callbacks: [new MyCallbackHandler()],
  func: async (data) => {
    const dir = path.join(process.env.STORE_FOLDER_URL, "repo");
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
      const ans = `You already have all the information you can get from this tool. unless you have a different question from ${repeatedQuery.question}
      `;
      logger.info(ans);
      return ans;
    }
    queries.push(currentQuery);

    // get all the related docs in prep for filtering
    let docs: Document<Record<string, any>>[] = [];
    try {
      const selfQueryRetriever = SelfQueryRetriever.fromLLM({
        llm: getSmartModel(),
        vectorStore,
        documentContents: REPO_VECTOR_STORE_SELF_QUERY_DESCRIPTION,
        attributeInfo: [
          {
            name: "source",
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
    const baseCompressor = LLMChainExtractor.fromLLM(getSmartModel());

    const ccRetriever = new ContextualCompressionRetriever({
      baseCompressor,
      baseRetriever: contextualCompRetriever,
      verbose: true,
    });
    const ccDocs = await ccRetriever.getRelevantDocuments(data.question);

    const qaRefineChain = loadQARefineChain(getSmartModel(), { verbose: true });
    const res = await qaRefineChain.call({
      input_documents: ccDocs.length ? ccDocs : docs.slice(0, 15),
      question: data.question,
    });
    currentQuery.answer = res.output_text ?? "";
    logger.info(currentQuery.answer);
    return currentQuery.answer;
  },
});
