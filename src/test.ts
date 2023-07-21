import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import dotenv from "dotenv";
import {
  VectorStoreToolkit,
  createVectorStoreAgent,
  VectorStoreInfo,
} from "langchain/agents";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAI } from "langchain/llms/openai";
dotenv.config();

export const repoQaExample = async () => {
  console.time("vectorStore");
  const vectorStore = await HNSWLib.load(".", new OpenAIEmbeddings());
  const result = await vectorStore.similaritySearch("standardBfqStore", 10);
  console.log(result);
};

repoQaExample();
