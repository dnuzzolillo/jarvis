import fs from 'fs';
import OpenAI from 'openai';
import * as readline from 'readline';

import { ChatCompletionContentPart, ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam, ChatCompletionUserMessageParam } from 'openai/resources/chat';
import { openaiClient } from './openai-client';
import { VectorMemory } from './memory';

export interface Tool {
    toolDefinition: OpenAI.ChatCompletionTool;
    callback: (param: Record<string, string>) => Promise<any>;
}

export interface Selection {
    actionName: string;
    params: Record<string, string>;
}

export enum StepType {
    THINKING,
    EXECUTION
}

export type AgentConfig = (Partial<Step> & { stepType: StepType })[];

export enum StepFrequency {
    FIRST,
    MORE_THAN,
    LESS_THAN,
    EVERY,
    EXCEPT,
    IF
}

export type StepBase = {
    userMessageFactory?: (t: string) => Promise<ChatCompletionContentPart[]>;
    appendUserMessage?: () => boolean;
    model: string;
    stepType: StepType;
    systemMessage: string | (StructuredContent );
} & (
    {
        frequency: StepFrequency.FIRST | StepFrequency.MORE_THAN | StepFrequency.LESS_THAN | StepFrequency.EVERY | StepFrequency.EXCEPT;
        frequencyParam: number;
    } | {
        frequency: StepFrequency.IF;
        frequencyParam: () => boolean;
    }
);

export type ThinkingStep = StepBase & {
    stepType: StepType.THINKING;
    callback: (responseContent: string) => any;
}

export type ExecutionStep = StepBase & {
    tools: Tool[];
    stepType: StepType.EXECUTION;
}

export type Step = ThinkingStep | ExecutionStep;

export interface StructuredContent {
    [key: string]: string | StructuredContent | string[];
}

export enum FeedbackType {
    POSITIVE = 'positive',
    NEGATIVE = 'negative',
    NEUTRAL = 'neutral'
}

export interface Feedback {
    feedback: string;
    feedbackType: string;
}

export class Agent {

    static client = openaiClient;

    static extractJsonFromString(input: string): string {
        const regex = /```json\s*([\s\S]*?)\s*```/;
        const match = input.match(regex);
        if (match && match[1]) {
            return match[1];
        } else {
            return input;
        }
    }

    messagesHistory: ChatCompletionMessageParam[] = [];
    records: Record<string, string> = {};
    memoryChunks: string[] = [];
    steps: Step[] = [];
    reasoningCycle: number = 0;
    stop: boolean = false;
    currentTask: string = '';
    feedbackHistory: Feedback[] = [];
    vectorMemory: VectorMemory = new VectorMemory();
    lastExecutedToolName: string = '';
    defaultModel: string = 'gpt-4-turbo-2024-04-09';

    constructor(config: AgentConfig) {
        this.setUpConfig(config);
    }

    setUpConfig(config: AgentConfig) {
        this.steps = config.map(this.getStepFromPartial.bind(this));
    }

    getStepBaseFromPartial(partial: Partial<StepBase> & { stepType: StepType }): StepBase {
        return {
            model: "gpt-4-vision-preview",
            frequency: StepFrequency.EVERY,
            frequencyParam: 1,
            systemMessage: '',
            appendUserMessage: () => true,
            ...partial
        } as StepBase;
    }

    getExecutionStepFromPartial(partial: Partial<ExecutionStep> & { stepType: StepType.EXECUTION }): ExecutionStep {
        return {
            ...this.getStepBaseFromPartial(partial),
            systemMessage: "You are an AI assistant that can help with a variety of tasks.",
            tools: [],
            ...partial
        } as ExecutionStep;
    }

    getThinkingStepFromPartial(partial: Partial<ThinkingStep> & { stepType: StepType.THINKING }): ThinkingStep {
        return {
            ...this.getStepBaseFromPartial(partial),
            systemMessage: '',
            callback: async () => { },
            ...partial
        } as ThinkingStep;
    }

    getStepFromPartial(partial: Partial<Step>): Step {
        if (partial.stepType === StepType.EXECUTION) {
            return this.getExecutionStepFromPartial(partial as Partial<ExecutionStep> & { stepType: StepType.EXECUTION });
        } else {
            return this.getThinkingStepFromPartial(partial as Partial<ThinkingStep> & { stepType: StepType.THINKING });
        }
    }


    allowsFunctionCalling(modelName: string) {
        return modelName !== "gpt-4-vision-preview";
    }

    resolveToolSelection: (res: OpenAI.ChatCompletion, selectFromString: boolean) => Selection | undefined = (response: OpenAI.ChatCompletion, selectFromString: boolean) => {
        try {
            const tollCalls = response.choices[0]?.message.tool_calls?.[0].function ?? JSON.parse(Agent.extractJsonFromString(response.choices[0]?.message.content || 'undefined'));
            if(!tollCalls) {
                return undefined;
            }
            const params = typeof (tollCalls.arguments || tollCalls.params) === 'string' ? JSON.parse(tollCalls.arguments || tollCalls.params) : tollCalls.arguments || tollCalls.params;
            return {
                actionName: tollCalls.name || tollCalls.actionName,
                params
            };
        } catch (error) {
            console.log('Error resolving tool selection', response.choices[0]?.message.content, error);
            return undefined;
        }
    }

    updateRecords(records: Record<string, string>) {
        this.records = {
            ...this.records,
            ...records
        };
    }

    async runFromCli() {
        const task = await this.promptUserWithCmd('What is the task you want to perform?');
        await this.runTask(task);
    }

    async runTask<T>(task: string): Promise<T | undefined> {
        this.currentTask = task;
        this.reasoningCycle++;
        for (const step of this.steps) {
            if (this.shouldSkipStep(step)) {
                continue;
            }
            if (step.stepType === StepType.EXECUTION) {
                const result: T = await this.runExecutionStep(step, task);
                if (result) {
                    return result;
                }
            } else {
                await this.runThinkingStep(step, task);
            }

        }
        return this.runTask(task);
    }

    async runThinkingStep(step: ThinkingStep, task: string): Promise<void> {

        const request: ChatCompletionCreateParamsNonStreaming = {
            model: step.model,
            messages: [
                {
                    role: "system",
                    content: this.getSystemPrompt(step)
                },
                ...this.messagesHistory.map((m: ChatCompletionMessageParam) => {
                    // remove non-text content from user messages
                    if (m.role === 'user') {
                        return {
                            role: m.role,
                            content: Array.isArray(m.content) ? m.content.filter(c => c.type === 'text') : m.content
                        }
                    }
                    return m;
                }),
            ],
            max_tokens: 1000,
            temperature: 0.3
        };

        if (step.userMessageFactory && step.appendUserMessage && await step.appendUserMessage()) {
            request.messages.push({
                role: "user",
                content: await step.userMessageFactory(task)
            });
        }

        const response = await Agent.client.chat.completions.create(request);
        const responseContent = response.choices[0]?.message.content || 'Could not get content';
        if (!step.callback) {
            return;
        }
        return step.callback instanceof Promise ? await step.callback(responseContent) : step.callback(responseContent);
    }

    async runExecutionStep(step: ExecutionStep, task: string): Promise<any> {
        const request: ChatCompletionCreateParamsNonStreaming = {
            model: step.model,
            messages: [
                {
                    role: "system",
                    content: this.getSystemPrompt(step)
                },
                ...this.messagesHistory.map((m: ChatCompletionMessageParam) => {
                    // remove non-text content from user messages
                    if (m.role === 'user') {
                        return {
                            role: m.role,
                            content: Array.isArray(m.content) ? m.content.filter(c => c.type === 'text') : m.content
                        }
                    }
                    return m;
                }),
            ],
            max_tokens: 1000,
            temperature: 0.3
        };
        if (step.userMessageFactory && step.appendUserMessage && await step.appendUserMessage()) {
            request.messages.push({
                role: "user",
                content: await step.userMessageFactory(task)
            });
        }
        if (this.allowsFunctionCalling(step.model)) {
            request.tools = step.tools.map(t => t.toolDefinition);
            request.tool_choice = 'auto';
        }
        const response = await Agent.client.chat.completions.create(request);
        const selection = this.resolveToolSelection(response, !this.allowsFunctionCalling(step.model as string));
        if(!selection) {
            console.log('No selection found for', response.choices[0]?.message.content);
            throw new Error('No selection found');
        }
        const tool = step.tools.find(tool => tool.toolDefinition.function.name === selection.actionName);
        if (tool) {
            this.messagesHistory.push({
                role: "assistant",
                content: JSON.stringify(selection)
            });
            if (selection.actionName === 'finish') {
                console.log('Task completed');
                this.messagesHistory = [];
                return await tool.callback(selection.params);
            }
            console.log('Executing tool', `${tool.toolDefinition.function.name}(${JSON.stringify(selection.params)})`)
            await tool.callback(selection.params);
        } else {
            console.log('No tool found for', response.choices[0]?.message.content);
        }
    }

    shouldSkipStep(step: Step): boolean {
        if (step.frequency === StepFrequency.IF) {
            return !step.frequencyParam();
        }
        switch (step.frequency) {
            case StepFrequency.FIRST:
                return this.reasoningCycle !== 1;
            case StepFrequency.EVERY:
                return this.reasoningCycle % step.frequencyParam !== 0;
            case StepFrequency.EXCEPT:
                return this.reasoningCycle % step.frequencyParam === 0;
            case StepFrequency.LESS_THAN:
                return this.reasoningCycle >= step.frequencyParam;
            case StepFrequency.MORE_THAN:
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

    static getStructuredMdContent(structuredContent: StructuredContent, depth: number = 1): string {
        const MAX_DEPTH = 3;
        let content = '';

        for (const key in structuredContent) {
            const value = structuredContent[key];
            content += `${'#'.repeat(depth > MAX_DEPTH ? MAX_DEPTH : depth)} ${key}\n`;
            if (typeof value === 'string') {
                content += value + '\n\n';
            } else {
                content += (() => {
                    if (typeof value === 'object') {
                        return Array.isArray(value) ? (value as string[]).map((v, i) => `${i + 1}. ${v}`).join('\n') : Agent.getStructuredMdContent(value as StructuredContent, depth + 1);
                    }
                    return value;
                })()
            }
        }
        return content;
    }

    getFilledTemplate(template: string, data: Record<string, string>): string {
        return template.replace(/{{\s*([^}]+)\s*}}/g, (match, key) => {
            return data[key] || '';
        });
    }

    getSystemPrompt(step: Step): string {
        return this.getFilledTemplate([
            typeof step.systemMessage === 'string' ? step.systemMessage : Agent.getStructuredMdContent({
                ...step.systemMessage,
            }),
            this.resolveToolDescription(step),
        ].join('\n'), {...this.records, task: this.currentTask});
    }

    resolveToolDescription(step: Step): string {
        if (step.stepType === StepType.EXECUTION && !this.allowsFunctionCalling(step.model)) {
            return Agent.getStructuredMdContent({
                ['You can use the following tools to complete the task']: JSON.stringify((step as ExecutionStep).tools, null, 2),
                ['Only respond using function calling as a JSON object, for example:']: '```json\n{\n  "name": "toolName",\n  "params": {\n    "param1": "value1",\n    "param2": "value2"\n  }\n}\n```'
            })
        } else if (step.stepType === StepType.EXECUTION) {
            return Agent.getStructuredMdContent({
                ['Expected response']: 'Do not respond with text, only respond using function calling',
            });
        }
        return '';
    }

}
