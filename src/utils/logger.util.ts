import { BaseCallbackHandler } from "langchain/callbacks";
import { Serialized } from "langchain/load/serializable";
import { ChainValues, AgentAction, AgentFinish } from "langchain/schema";
import path from "path";
import { createLogger, format, transports } from "winston";

// Generate filename with timestamp
const timestamp = Date.now();
const filename = path.join(`./logs/${timestamp}_app.log`);

// Create a logger instance
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [new transports.File({ filename })],
});

export default logger;

export class MyCallbackHandler extends BaseCallbackHandler {
  name = "MyCallbackHandler";

  async handleChainStart(chain: Serialized) {
    logger.info(`Entering new ${chain.id} chain...`);
  }

  async handleChainEnd(_output: ChainValues) {
    logger.info("Finished chain.");
  }

  async handleAgentAction(action: AgentAction) {
    logger.info(action.log);
  }

  async handleToolEnd(output: string) {
    logger.info(output);
  }

  async handleText(text: string) {
    logger.info(text);
  }

  async handleAgentEnd(action: AgentFinish) {
    logger.info(action.log);
  }
}
