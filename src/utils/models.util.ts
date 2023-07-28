import { OpenAI } from "langchain/llms/openai";
import { MyCallbackHandler } from "./logger.util";

export const getSmartModel = (temperature = 0, useLogger = false) => {
  return new OpenAI({
    temperature,
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4",
    callbacks: useLogger ? [new MyCallbackHandler()] : [],
    verbose: useLogger,
  });
};

export const getDumbModel = (temperature = 0, useLogger = false) => {
  return new OpenAI({
    temperature,
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-3.5",
    callbacks: useLogger ? [new MyCallbackHandler()] : [],
  });
};
export const getLargeContextSmartModel = (temperature = 0) => {
  return new OpenAI({
    temperature,
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4-32k",
  });
};

export const getLargeContextDumbModel = (temperature = 0) => {
  return new OpenAI({
    temperature,
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-3.5-turbo-16k",
  });
};
