import { Agent, Tool } from "../../../agent";
import { executionStepReasoningPropDefinition } from "./params";
import { ChatCompletionContentPart, ChatCompletionCreateParamsNonStreaming } from "openai/resources";
import { BrowserController } from "../../../browser";

const getContentExtrationSystemPrompt = (task: string) => ({
    'Role': 'You are an AI agent who\'s job is to extract relevan information from screenshots.',
    'Response Format': 'You only speak JSON, and you must provide an array of text strings that represent the relevant information extracted from the content. If you can\'t find the information, you should provide an empty array.',
    'Example task': 'Extract the relevant information about: How to make a cake',
    'Example response': `\`\`\`json
    [
        "The ingredients needed to make a cake are: flour, sugar, eggs, butter, and milk.",
        "The steps to make a cake are: 1. Mix the ingredients. 2. Bake the mixture in the oven."
    ]`,
    'Task': `Extract the relevant information about: ${task}`,

});

export const getContentExtractionStep = async (browser: BrowserController, task: string): Promise<any> => {
    const md = Agent.getStructuredMdContent(getContentExtrationSystemPrompt(task));
    const screenshots = await browser.takeFullPageScreenshot();
    let dataChuks: string[] = [];
    for (const base64 of screenshots) {
        const userMessage: Array<ChatCompletionContentPart> = [
            {
                "type": "image_url",
                "image_url": 'data:image/png;base64,' + base64 as any,
            }
        ]
        const request: ChatCompletionCreateParamsNonStreaming = {
            model: 'gpt-4-vision-preview',
            messages: [
                {
                    role: "system",
                    content: md
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            max_tokens: 1000,
            temperature: 0.3
        };
        const response = await Agent.client.chat.completions.create(request);
        const responseContent = response.choices[0]?.message.content || '[]';
        let parsedResponse = '';
        try {
            parsedResponse = JSON.parse(responseContent);
        } catch (error) {
            // remove json formatting
            parsedResponse = responseContent.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        dataChuks = [
            ...dataChuks,
            ...parsedResponse
        ]
    }

    // now we need to summarize the data with another model
    const summarizationSystemPrompt = {
        'Role': 'You are an AI agent who\'s job is to summarize the extracted information from the screenshots.',
        'Data subject': `The extracted information is about: ${task}`,
        'Expected response': 'You should provide a summary of the extracted information in a single text string.',
    }
    const request: ChatCompletionCreateParamsNonStreaming = {
        model: 'gpt-4-turbo-2024-04-09',
        messages: [
            {
                role: "system",
                content: Agent.getStructuredMdContent(summarizationSystemPrompt)
            },
            {
                role: "user",
                content: dataChuks.join('\n')
            }
        ],
        max_tokens: 1000,
        temperature: 0.3
    };

    const response = await Agent.client.chat.completions.create(request);
    const responseContent = response.choices[0]?.message.content || 'No data found';
    return responseContent;
}

export const contentExtractionTool = (agent: Agent, browser: BrowserController): Tool => {
    return {
        toolDefinition: {
            type: 'function',
            function: {
                name: 'extract_relevant_information',
                description: 'Extract relevant information from the page',
                parameters: {
                    type: "object",
                    properties: {
                        topic: {
                            type: "string",
                            description: "Description of the topic to extract information about",
                        }
                    },
                    required: ['topic']
                }
            }
        },
        callback: async (params: Record<string, string>) => {
            const content = await getContentExtractionStep(browser, params.topic);
            agent.messagesHistory.push({
                role: 'assistant',
                content: 'content extraction result: ' + content,
            });

        }
    }
}