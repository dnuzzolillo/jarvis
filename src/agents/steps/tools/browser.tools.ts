import { Tool } from "../../../agent";
import { BrowserController } from "../../../browser";
import { executionStepReasoningPropDefinition } from "./params";

export const navigateTool = ((browser: BrowserController): Tool => ({
    toolDefinition: {
        type: 'function',
        function: {
            name: 'navigate_by_url',
            description: 'Navigate to the given URL',
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "URL to navigate to",
                    },
                    ...executionStepReasoningPropDefinition
                },
                required: ['url', 'analysis']
            }
        }

    },
    callback: async (params: Record<string, string>) => {
        await browser.navigate(params.url);
    }
}))

export const clickTool = ((browser: BrowserController) => ({
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
                    ...executionStepReasoningPropDefinition
                },
                required: ['element_id', 'analysis']
            }
        }
    },
    callback: async (params: Record<string, string>) => {
        await browser.click(params.element_id);
    }
}))

export const typeTool = ((browser: BrowserController) => ({
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
                    replace_existing: {
                        type: "boolean",
                        description: "Replace existing text in the input field",
                    },
                    ...executionStepReasoningPropDefinition
                },
                required: ['text', 'element_id', 'analysis']
            }
        }

    },
    callback: async (params: Record<string, any>) => {
        await browser.type(params.element_id, params.text, {
            pressEnter: params.press_enter,
            replaceExisting: params.replace_existing
        });
    }
}))

export const scrollTool = ((browser: BrowserController): Tool => ({
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
                    element_id: {
                        type: "string",
                        description: "use it if you want to scroll to a specific element",
                    },
                    ...executionStepReasoningPropDefinition
                },
                required: ['direction', 'analysis']

            }
        }

    },
    callback: async (params: Record<string, string>) => {
        await browser.scroll(params.direction as 'up' | 'down', params.element_id || 'body');
    }
}))

export const goBackTool = ((browser: BrowserController) => ({
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
            await browser.page?.goBack();
        }
    }
}))

export const extractTextTool = ((browser: BrowserController) => ({
    toolDefinition: {
        type: 'function',
        function: {
            name: 'extract_text',
            description: 'Extract text from the page',
            parameters: {
                type: "object",
                properties: {
                    text: {
                        type: "string",
                        description: "Text to extract",
                    },
                },
                required: ['text']
            }
        }
    },
    callback: async (params: Record<string, string>) => {
        //return await browser.extractText(params.element_id);
    }
}))

export const getBrwoserCrawlingTools = (browser: BrowserController) => [ 
    navigateTool(browser),
    clickTool(browser),
    typeTool(browser),
    scrollTool(browser),
    goBackTool(browser),
    {
        toolDefinition: {
            type: 'function',
            function: {
                name: 'await load',
                description: 'Wait for a few seconds when the page is loading',
                parameters: {
                    type: "object",
                    properties: {
                        seconds: {
                            type: "number",
                            description: "Number of seconds to wait",
                        },
                    },
                    required: ['seconds']
                }
            }
        },
        callback: async (params: Record<string, number>) => {
            await browser.page?.waitForTimeout(params.seconds * 1000);
        }
    }
] as Tool[];