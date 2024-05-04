import { GeneralAgent } from "./src/agents/core-agent.agent";

(async _=> {
    const agent = new GeneralAgent();
    await agent.runFromCli()
})()

