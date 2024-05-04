import { Agent, StepType } from "../agent";

export class RelevantDataCollectorAgent extends Agent {

    dataForPremises: Record<string, string> = {};

    constructor() {
        super([
            {   
                model: 'gpt-4-0125-preview',
                systemMessage: {
                    role: 'Your are an AI agent who\'s job is to collect data from the user to perform a task.',
                    'Data to collect': '{{premises}}',
                },
                stepType: StepType.EXECUTION,
                tools: [
                    {
                        toolDefinition: {
                            type: 'function',
                            function: {
                                name: 'prompt_user',
                                description: 'Prompt the user one for each premise to collect data',
                                parameters: {
                                    type: "object",
                                    properties: {
                                        question: {
                                            type: "string",
                                            description: "The question to ask the user"
                                        },
                                        premise: {
                                            type: "string",
                                            description: "The premise to collect data from"
                                        }
                                    },
                                    required: [
                                        "question",
                                        "premise"
                                    ]
                                },
                            },
                        },
                        callback: async (params: Record<string, string>) => {
                            const data = await this.promptUserWithCmd(params.question);
                            this.dataForPremises[params.premise] = data;
                            this.messagesHistory.push({
                                role: 'user',
                                content: data
                            });
                        }
                    },
                    {
                        toolDefinition: {
                            type: 'function',
                            function: {
                                name: 'finish',
                                description: 'Finish the task',
                                parameters: {
                                    type: "object",
                                    properties: {
                                        success: {
                                            type: "boolean",
                                            description: "Whether the task was successful or not"
                                        }
                                    },
                                    required: [
                                        "success"
                                    ]
                                },
                            },
                        },
                        callback: async (params: Record<string, string>) => {
                            return this.dataForPremises;
                        }
                    }
                ]
            }
        ]);
    }
}