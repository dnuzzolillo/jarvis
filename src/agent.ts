import { config } from 'dotenv';
import fs from 'fs';
import OpenAI from 'openai';
import * as readline from 'readline';

import { ChatCompletionContentPart, ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam, ChatCompletionUserMessageParam } from 'openai/resources/chat';


export interface Tool {
    toolDefinition: OpenAI.ChatCompletionTool;
    callback: (param: Record<string, string>) => Promise<void | string>;
}

export interface Selection {
    actionName: string;
    params: Record<string, string>;
}

export type AgentConfig = Partial<ReasoningStep>[];

export enum ReasoningStepFrequency {
    FIRST,
    MORE_THAN,
    LESS_THAN,
    EVERY,
    EXCEPT
}

export interface ReasoningStep {
    tools: Tool[];
    userMessageFactory: (t: string) => Promise<ChatCompletionContentPart[]>;
    model: string;
    curriculum: string;
    frequency: ReasoningStepFrequency;
    frequencyParam: number;
}

export class Agent {

    static client = new OpenAI();

    static extractJsonFromString(input: string): string {
        const regex = /```json\s*([\s\S]*?)\s*```/;
        const match = input.match(regex);
        if (match && match[1]) {
            return match[1];
        } else {
            return input;
        }
    }
    
    selectionHistory: Selection[] = [];
    messagesHistory: ChatCompletionMessageParam[] = [];
    cachedPlan: string = '';
    userFeedbackEverySteps: number = 3;
    reasoningSteps: ReasoningStep[] = [];
    reasoningCycle: number = 0;

    constructor(config: AgentConfig) {
        this.reasoningSteps = config.map(step => ({
            userMessageFactory: (t: string) => Promise.resolve([
                {
                    "type": "text",
                    "text": t,
                }
            ]),
            model: "gpt-4-vision-preview",
            curriculum: "You are an AI assistant that can help with a variety of tasks.",
            userFeedbackEverySteps: Infinity,
            tools: [],
            frequency: ReasoningStepFrequency.EVERY,
            frequencyParam: 1,
            ...step
        }));
    }

    isVisionModel(modelName: string) {
        return modelName === "gpt-4-vision-preview";
    }

    resolveToolSelection: (res: OpenAI.ChatCompletion, selectFromString: boolean) => Selection = (response: OpenAI.ChatCompletion, selectFromString: boolean) => {
        const tollCalls = selectFromString
        ? JSON.parse(Agent.extractJsonFromString(response.choices[0]?.message.content || 'undefined'))
        : response.choices[0]?.message.tool_calls?.[0].function;

        return {
            actionName: tollCalls.name || tollCalls.actionName,
            params: tollCalls.arguments || tollCalls.params
        };
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

    async runTask(task: string): Promise<void> {
        this.reasoningCycle++;
        for(const step of this.reasoningSteps) {

            if (this.shouldSkipStep(step)) {
                continue;
            }

            const userMessage: ChatCompletionMessageParam  = {
                role: "user",
                content: await step.userMessageFactory(task)
            };
            
            const request: ChatCompletionCreateParamsNonStreaming = {
                model: step.model,
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(task, step)
                    },
                    ...this.messagesHistory.map((m: ChatCompletionMessageParam) => {
                        // remove non-text content from user messages
                        if (m.role === 'user' && Array.isArray(m.content)) {
                            return {
                                role: m.role,
                                content: m.content.filter(c => c.type === 'text')
                            }
                        }
                        return m;
                    }),
                    ...(userMessageGenerated => {
                        if(userMessage.content.length) {
                            return [userMessageGenerated];
                        }
                        return [];
                    })(userMessage)
                ],
                max_tokens: 1000,
                temperature: 0.3
            };
    
            if (!this.isVisionModel(step.model)) {
                request.tools = step.tools.map(t => t.toolDefinition);
            }
            console.log('Sending request');
            const response = await Agent.client.chat.completions.create(request);

            if(!step.tools.length) {
                this.messagesHistory.push({
                    role: "assistant",
                    content: response.choices[0]?.message.content
                });
                console.log('Assistant:', response.choices[0]?.message.content);
                continue;
            }

            const selection = this.resolveToolSelection(response, this.isVisionModel(step.model as string));
            const tool = step.tools.find(tool => tool.toolDefinition.function.name === selection.actionName);
            if (tool) {
                this.messagesHistory.push({
                    role: "assistant",
                    content: JSON.stringify(selection)
                });
                if (selection.actionName === 'finish') {
                    console.log('Task completed');
                    console.log('/////////////////////////////');
                    this.selectionHistory = [];
                    const fs = require('fs');
                    fs.writeFileSync('output.json', JSON.stringify(this.messagesHistory, null, 2));
                    return;
                }
                console.log('Executing tool', `${tool.toolDefinition.function.name}(${JSON.stringify(selection.params)})`)
                await tool.callback(selection.params);
            } else {
                console.log('No tool found for', response.choices[0]?.message.content);
            }
        }
        return await this.runTask(task);
    }

    shouldSkipStep(step: ReasoningStep): boolean {
        switch (step.frequency) {
            case ReasoningStepFrequency.FIRST:
                return this.reasoningCycle !== 1;
            case ReasoningStepFrequency.EVERY:
                return this.reasoningCycle % step.frequencyParam !== 0;
            case ReasoningStepFrequency.EXCEPT:
                return this.reasoningCycle % step.frequencyParam === 0;
            case ReasoningStepFrequency.LESS_THAN:
                return this.reasoningCycle >= step.frequencyParam;
            case ReasoningStepFrequency.MORE_THAN:
                return this.reasoningCycle <= step.frequencyParam;
        }
    }

    promptUserWithCmd(question: string): Promise<string> {
        // Create a readline interface
        // use blue color for the question
        console.log('\x1b[36m%s\x1b[0m', question);
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('Type your answer:', (answer: string) => {
                rl.close();
                resolve(answer);
            });
        });
    }

    getSystemPrompt(task: string, reasoningStep: ReasoningStep): string {
        return `## Curriculum
        ${reasoningStep.curriculum}
                
        ## Given task
        ${task}
                
        ${this.isVisionModel(reasoningStep.model) && reasoningStep.tools.length ? `## You can use the following tools to complete the task
        ${JSON.stringify(reasoningStep.tools, null, 2) }
        
        Only respond using function calling as a JSON object, for example:
        \`\`\`json
        {
            "name": "navigate",
            "arguments": {
                "url": "https://www.google.com"
            }
        }
        \`\`\`` : ''}
    `
    }
}



