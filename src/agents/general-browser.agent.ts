import fs from 'fs';
import { Agent, StepFrequency, StepType, Tool } from '../agent';
import { BrowserController } from '../browser';
import { ChatCompletionContentPart } from 'openai/resources/chat';
import { RelevantDataCollectorAgent } from './user-data-collector.agent';
import { getBrwoserCrawlingTools } from './steps/tools';

export enum BrowserTaskType {
    CRAWL = 'CRAWL',
    OBSERVE = 'OBSERVE',
    FILL_FORM = 'FILL_FORM',
}


export class BrowserAgent extends Agent {
    browser: BrowserController = new BrowserController();

    constructor() {
        super([]);
        this.setUpConfig([
            // {
            //     stepType: StepType.THINKING,
            //     model: 'gpt-4-turbo-2024-04-09',
            //     systemMessage: {
            //         role: `You are an AI agent who reason about the task you are given to perform using the web browser.`,
            //         'How you operate': `You have to analyze the given task and answer: What information do i need to be precise in the execution this task?`,
            //         'response format': `You must provide a list of information you need to be precise in the execution of the task.`
            //     },
            //     callback: async (response: string) => {
            //         const relevantDataCollector: RelevantDataCollectorAgent = new RelevantDataCollectorAgent();
            //         const premisesObj = await relevantDataCollector.runTask<Record<string, string>>(response) || {};
            //         this.updateStructuredContent({
            //             premises: {
            //                 ...premisesObj
            //             }
            //         });
            //     },
            // },
            {
                stepType: StepType.THINKING,
                frequency: StepFrequency.FIRST,
                model: 'gpt-4-turbo-2024-04-09',
                systemMessage: {
                    role: `You are an AI agent who reason about the task you are given to perform using the web browser.`,
                    'How you operate': `You have to analyze the given task and answer: What steps do i need to take to perform this task?`,
                    'Task': `Perform the following task: {{task}}`,
                },
                callback: (response: string) => {
                    console.log('plan', response)
                    this.updateRecords({
                        plan: response
                    })
                },
            },
            {
                systemMessage: {
                    role: `You are an AI agent who's job is to operate a web browser, you are given a task to perform. you must navigate to the URL you think is the best to perform the task.`,
                    'How you should perform the task': `Perform the following task: {{plan}}`,
                    'Task': `Perform the following task: {{task}}`,
                },
                stepType: StepType.EXECUTION,
                frequency: StepFrequency.IF,
                frequencyParam: () => !this.browser.page,
                tools: [
                    {
                        toolDefinition: {
                            type: 'function',
                            function: {
                                name: 'navigate',
                                description: 'Navigate to the given URL',
                                parameters: {
                                    type: "object",
                                    properties: {
                                        url: {
                                            type: "string",
                                            description: "URL to navigate to",
                                        },
                                    },
                                    required: ['url']
                                }
                            }
                        },
                        callback: async (params: Record<string, string>) => {
                            await this.browser.navigate(params.url);
                        }
                    }
                ],
            },
            {
                stepType: StepType.EXECUTION,
                systemMessage: {
                    role: `You are an AI agent who's job is to operate a web browser while being supervised.
You are given a screenshot of the browser, and you must use the screenshot to what elements to interact with.
To interact with elements, use the tools and the hints placed each element.`,
                    'How you should perform the task': `Perform the following task: {{plan}}`,
                    notes: [
                        `When you need to login, ask the user to do so and then continue with the task`,
                        `Pay special attention to avoid to repeat actions that are already done`,
                        `Try to scroll down if you can't find the element you are looking for`,
                    ],
                    'Task': `Perform the following task: {{task}}`,
                },
                frequency: StepFrequency.EVERY,
                tools: [
                    ...getBrwoserCrawlingTools(this.browser)
                ],
                userMessageFactory: async (task: string) => {
                    const xamlMap = await this.browser.takeScreenshot();
                    const base64: any = await this.imageToBase64('screenshot.png');
                    const userMessage: Array<ChatCompletionContentPart> = [
                        {
                            "type": "image_url",
                            "image_url": base64,
                        },
                        {
                            "type": "text",
                            "text": `current url: ${this.browser.page?.url()}`,
                        },
                        {
                            "type": "text",
                            "text": `UI map: ${xamlMap}`,
                        }
                    ]
                    return userMessage;
                }
            },

            {
                stepType: StepType.THINKING,
                systemMessage: {
                    role: `You are supervising the AI agent who is operating a web browser.`
                    +`Your job is to analyze the previous steps taken by the AI agent and`
                    +`check if the the AI is performing the task correctly according to the given plan.`
                    +`And provide feedback to the AI agent.`,
                    'Detect loops': `If the AI agent is repeating the same actions, you should provide feedback to the AI agent.`,
                    'Task': `The AI agent is performing the following task: {{task}}`,
                    'Response format': `Explain concisely what the AI agent is doing wrong and what the AI agent should do instead.`,
                },
                model: 'gpt-4-turbo-2024-04-09',
                frequency: StepFrequency.EVERY,
                frequencyParam: 3,   
                callback: async (response: string) => {
                    console.log('feedback', response);
                    this.messagesHistory.push({
                        role: 'user',
                        content: 'Feedback: '+response
                    });
                }
            }
        ]);
    }

    async imageToBase64(image_file: any) {
        return await new Promise((resolve, reject) => {
            fs.readFile(image_file, (err, data) => {
                if (err) {
                    console.error('Error reading the file:', err);
                    reject();
                    return;
                }

                const base64Data = data.toString('base64');
                const dataURI = `data:image/png;base64,${base64Data}`;
                resolve(dataURI);
            });
        });
    }

    async run() {
        const task: string = await this.promptUserWithCmd('What task would you like to perform?');
        await this.runTask(task);
    }

}



