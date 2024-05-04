import { Agent, Tool } from "../../../agent";

export const finishTool = {
    toolDefinition: {
        type: 'function',
        function: {
            name: 'finish',
            description: 'Finish the given task',
            parameters: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        description: "Was the task successful?",
                    },
                    conclusion: {
                        type: "string",
                        description: "What is the conclusion of the task you performed?",
                    },
                },
                required: [
                    'success',
                    'conclusion'
                ]
            },
        }
    },
    callback: async (params: Record<string, string>) => {
        return { 
            success: params.success,
            conclusion: params.conclusion
        };
    }
} as Tool;