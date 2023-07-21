import dotenv from "dotenv";
import { generateAST } from "./utils/store.util";
import { initRepoQaAgent } from "./agents/qa.agent";
import { input } from "@inquirer/prompts";
dotenv.config();

const main = async () => {
  await generateAST();
  const executor = await initRepoQaAgent();
  const val = await input({ message: "Enter your question" });
  executor.call({ input: val });
};

main();
