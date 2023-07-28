import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { astQueryTool } from "../tools/ast-qeury.tool";
import { getDumbModel, getSmartModel } from "../utils/models.util";
import { BufferMemory } from "langchain/memory";
import { MessagesPlaceholder } from "langchain/prompts";
import { repoQueryTool } from "../tools/repo-qeury.tool";
import { MyCallbackHandler } from "../utils/logger.util";

export const initRepoQaAgent = async () => {
  return await initializeAgentExecutorWithOptions(
    [repoQueryTool, astQueryTool],
    getSmartModel(),
    {
      agentType: "structured-chat-zero-shot-react-description",
      verbose: true,
      memory: new BufferMemory({
        memoryKey: "chat_history",
        returnMessages: true,
      }),
      agentArgs: {
        inputVariables: ["input", "agent_scratchpad", "chat_history"],
        memoryPrompts: [new MessagesPlaceholder("chat_history")],
      },
      callbacks: [new MyCallbackHandler()],
    }
  );
};
