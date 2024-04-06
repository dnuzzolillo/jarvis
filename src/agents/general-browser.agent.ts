import fs from 'fs';
import { Agent, StepFrequency, Tool } from '../agent';
import { BrowserController } from '../browser';
import { ChatCompletionContentPart } from 'openai/resources/chat';

const stepAnalysisPropDefinition = {
    analysis: {
        type: "string",
        description: "Create a brief analysis of what you learned from the screenshot",
    },
    expectedResults: {
        type: "string",
        description: "What are the expected results of this action?",
    },
    frustration: {
        type: "string",
        description: "How frustrated are you with this task?",
    },
}

export class BrowserNavigatorAgent extends Agent {
    browser: BrowserController = new BrowserController();

    constructor() {
        super([
            // Step 1 navigate to initial URL
            {
                curriculum: `You are an AI agent who's job is to operate a web browser, you are given a task to perform. you must navigate to the URL you think is the best to perform the task.`,
                frequency: StepFrequency.FIRST,
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
                                        ...stepAnalysisPropDefinition
                                    },
                                    required: ['url', 'analysis']
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
            curriculum: `You are an AI agent who's job is to operate a web browser while being supervised by a human.
            You are given a screenshot of the browser, and you must use the screenshot to what elements to interact with.
            To interact with elements, use the tools and the hints placed each element.
            When you are not sure what to do, you can ask the user for help.
            
            
            ### Notes
            - Please interact with the user as mutch as possible to learn from the user's feedback.
            Every 3 steps, you should ask the user for feedback on the task you are performing
            
            - When you need to login, ask the user to do so and then continue with the task`,
            frequency: StepFrequency.EVERY,
            tools: [
                {
                    toolDefinition: {
                        type: 'function',
                        function: {
                            name: 'finish',
                            description: 'Finish the given task',
                            parameters: {
                                type: "object",
                                properties: {
                                    afterthoughts: {
                                        type: "string",
                                        description: "Create an afterthoughts of the task you performed describing the steps you took. What did you learn? What would you do differently next time?",
                                    },
                                },
                                required: ['afterthoughts']
                            },
                        }

                    },
                    callback: async (params: Record<string, string>) => {
                        console.log(`Finished: ${params.finishReason}`);
                    }
                },
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
                                    ...stepAnalysisPropDefinition
                                },
                                required: ['url', 'analysis']
                            }
                        }

                    },
                    callback: async (params: Record<string, string>) => {
                        await this.browser.navigate(params.url);
                    }
                },
                {
                    toolDefinition: {
                        type: 'function',
                        function: {
                            name: 'click',
                            description: 'Click on element',
                            parameters: {
                                type: "object",
                                properties: {
                                    element_id: {
                                        type: "string",
                                        description: "Use the hint (placed in the top left corner of the element) to specify the character string to click on",
                                    },
                                    ...stepAnalysisPropDefinition
                                },
                                required: ['element_id', 'analysis']
                            }
                        }
                    },
                    callback: async (params: Record<string, string>) => {
                        await this.browser.click(params.element_id);
                    }
                },
                {
                    toolDefinition: {
                        type: 'function',
                        function: {
                            name: 'type',
                            description: '',
                            parameters: {
                                type: "object",
                                properties: {
                                    text: {
                                        type: "string",
                                        description: "Text to type",
                                    },
                                    element_id: {
                                        type: "string",
                                        description: "The character string to focus on",
                                    },
                                    press_enter: {
                                        type: "boolean",
                                        description: "Press enter after typing the text (useful for search boxes)",
                                    },
                                    ...stepAnalysisPropDefinition
                                },
                                required: ['text', 'element_id', 'analysis']
                            }
                        }

                    },
                    callback: async (params: Record<string, string>) => {
                        await this.browser.type(params.element_id, params.text, params.press_enter as any);
                    }
                },
                // scroll
                {
                    toolDefinition: {
                        type: 'function',
                        function: {
                            name: 'scroll',
                            description: 'Scroll up or down',
                            parameters: {
                                type: "object",
                                properties: {
                                    direction: {
                                        type: "string",
                                        description: "Direction to scroll",
                                    },
                                    ...stepAnalysisPropDefinition
                                },
                                required: ['direction', 'analysis']

                            }
                        }

                    },
                    callback: async (params: Record<string, string>) => {
                        await this.browser.scroll(params.direction as 'up' | 'down');
                    }
                },
                {
                    toolDefinition: {
                        type: 'function',
                        function: {
                            name: 'go_back',
                            description: 'Go back to the previous page',
                            parameters: {
                                type: "object",
                                properties: {
                                    times: {
                                        type: "number",
                                        description: "Number of times to go back",
                                    },
                                }
                            }
                        }
                    },
                    callback: async (params: Record<string, string>) => {
                        const times = parseInt(params.times);
                        for (let i = 0; i < times; i++) {
                            await this.browser.page?.goBack();
                        }
                    }

                },
                {
                    toolDefinition: {
                        type: 'function',
                        function: {
                            name: 'prompt_user',
                            description: 'Prompt the user with a message',
                            parameters: {
                                type: "object",
                                properties: {
                                    prompt: {
                                        type: "string",
                                        description: "Prompt to show to the user",
                                    },
                                },
                                required: ['prompt']
                            }
                        },
                    },
                    callback: async (params: Record<string, string>) => {
                        const userInput: string = await this.promptUserWithCmd(params.prompt);
                        this.messagesHistory.push({
                            role: "user",
                            content: userInput
                        });
                    }
                }

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
                        "text": `UI map: ${xamlMap}`,
                    }
                ]
                return userMessage;
            }
        },

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



