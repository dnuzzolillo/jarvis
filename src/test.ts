import OpenAI from "openai";
import { Agent } from "./agent";
import { BrowserController } from "./browser";
import playwright from 'playwright';
import { VectorMemory } from "./memory";
import { getContentExtractionStep } from "./agents/steps/tools/content-extraction.step";

(async () => {
    (async () => {   
        const browser = new BrowserController('https://www.reddit.com/search/?q=Telegram+bot+transcribe+voice+notes');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await getContentExtractionStep(browser, 'information about a chatbot in telegram');
    })();

    (async () => {
        // const memory = new VectorMemory();
        // const agent = new Agent([]);
        // console.log(agent.getFilledTemplate('{{test}}', { test: 'test' }));
        // memory.insertDocuments([
        //     {   
        //         // GHC, help me write a paragraph about how to send a email in gmail
        //         pageContent: `
        //         To send an email in Gmail, follow these steps:
        //         1. Open Gmail in your web browser.
        //         2. Click on the "Compose" button.
        //         3. Enter the recipient's email address in the "To" field.
        //         4. Enter the subject of the email in the "Subject" field.
        //         5. Write your message in the body of the email.
        //         6. Click the "Send" button to send the email.
        //         `,
        //         metadata: {
        //             task: 'send an email in gmail',
        //         }
        //     }
        // ])

        // await memory.wipeDocuments();

        // console.log(await memory.search('send an email in gmail to michel velasquez', 1));
    })();

    // (async () => {
    //     const req: OpenAI.ChatCompletionCreateParams = {
    //         "model": "gpt-4-0125-preview",
    //         "messages": [
    //           {
    //             "role": "system",
    //             "content": "# role\nYou are an AI agent who's job is to operate a web browser, you are given a task to perform. you must navigate to the URL you think is the best to perform the task.\n\n\n# Given Task\nsend an email to michel velasquez saying this is a test from an davids assistant, use gmail\n\n# Your plan\nTo send an email to Michel Velasquez using Gmail, please follow these steps:\n\n1. **Open Gmail**: Go to [Gmail](https://mail.google.com/) in your web browser. If you're not already logged in, you'll need to log in with your Google account credentials.\n\n2. **Compose a New Email**:\n   - Click on the `Compose` button, usually located at the top left side of the Gmail interface.\n   \n3. **Enter Recipient Details**:\n   - In the \"To\" field, type Michel Velasquez's email address. If you don't know it, please provide it so I can complete this step.\n\n4. **Write the Email**:\n   - Subject: You can enter a subject like \"Test Email\".\n   - Body: Type the message \"This is a test from David's assistant.\"\n\n5. **Send the Email**:\n   - Once you have composed your email, click the `Send` button to send the email to Michel Velasquez.\n\nIf you need any more help or if you want me to perform any of these steps, please let me know!\n\n\n# Expected response\nONLY respond using function calling\n\n"
    //           },
    //         ],
    //         "max_tokens": 1000,
    //         "temperature": 0.3,
    //         "tools": [
    //           {
    //             "type": "function",
    //             "function": {
    //               "name": "navigate",
    //               "description": "Navigate to the given URL",
    //               "parameters": {
    //                 "type": "object",
    //                 "properties": {
    //                   "url": {
    //                     "type": "string",
    //                     "description": "URL to navigate to"
    //                   },
    //                   "analysis": {
    //                     "type": "string",
    //                     "description": "Create a brief analysis of what you learned from the screenshot"
    //                   },
    //                   "expectedResults": {
    //                     "type": "string",
    //                     "description": "What are the expected results of this action?"
    //                   }
    //                 },
    //                 "required": [
    //                   "url",
    //                   "analysis"
    //                 ]
    //               }
    //             }
    //           }
    //         ],
    //         "tool_choice": "auto"
    //       }
    //       const openai = new OpenAI();
    //       console.log(JSON.stringify(await openai.chat.completions.create(req)));
    // })()
})()