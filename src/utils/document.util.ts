// creating and manipulating documents

import { TokenTextSplitter } from "langchain/text_splitter";

export const createDocumentsFromInput = async (
  input: string,
  metaData: any,
  chunkSize = 2000
) => {
  const splitter = new TokenTextSplitter({
    encodingName: "gpt2",
    chunkSize,
    chunkOverlap: 100,
  });
  return await splitter.createDocuments([input], [metaData]);
};
