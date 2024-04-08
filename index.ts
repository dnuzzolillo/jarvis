import { BrowserNavigatorAgent } from './src/agents/general-browser.agent';

(async _=> {
    const agent = new BrowserNavigatorAgent();
    await agent.run()
})()

