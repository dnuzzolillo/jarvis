import { Agent } from "./agent";
import { BrowserController } from "./browser";
import playwright from 'playwright';

(async () => {
    // (async () => {   
    //     const browser = new BrowserController('https://github.com/search?q=typescript+web+content+extractor&type=repositories');
    //     setTimeout(async () => {
    //         browser.applySom();
    //     }, 3000);
    // })();

    const agent = new Agent([]);
    console.log(agent.mdToStructuredContent(`## Curriculum
    You are an AI assistant that can help with a variety of tasks.
    ## Given task
    Navigate to https://www.google.com
    ## Reasoning
    ### Premises
    1. You are an AI assistant that can help with a variety of tasks.
    ### Plan
    1. Navigate to https://www.google.com
    2. Click on the search input`
    ));
})()