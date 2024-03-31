import { config } from 'dotenv';
import { BrowserNavigatorAgent } from './src/agents/general-browser.agent';
config({
    path: './.env'
});

(async _=> {
    const agent = new BrowserNavigatorAgent();
    await agent.run()
})()

