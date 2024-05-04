import { Agent, StepType } from "../agent";
import { BrowserController } from "../browser";
import { BrowserCrawlerAgent } from "./browser-crawler.agent";
import { getEvaluateResultStep } from "./steps";
import { contentExtractionTool, finishTool, promptUserTool } from "./steps/tools";
import { browserSomUMF } from "./steps/user-message-fatories";

const agetInstructions = `
You are an AI agent the controls other agents to complete the given task
You are operating in a web browser and you must use the subordinates agent to complete the task.

The subordinate agents are:
- Crawling agent: Use this agent to navigate and crawl the web.
- Data extraction: Use this agent to extract the data from the current page the browser is - use summarize the page content or to extract general information.
- Form filling agent: Use this agent to fill forms on the web page.

Each agent has a speciality to operate the web borwser, so you must separate the task into subtasks and assign each subtask to the agent that can complete it.
For example: If you want to send an email, you can use the crawling agent to navigate unitl you get to the email creation page, then you can use the form filling agent to fill the email form and send the email.

Another example: If you want to get the weather forecast, you can use the crawling agent to navigate to the weather website, then you can use the observation agent to get the weather forecast and provide the analysis.

#Finish
Once you have completed the task, use the finish tool to finish the task and provide feedback to the AI agent.
`;

export class GeneralAgent extends Agent {
    constructor() {
        super([]);
        const browser = new BrowserController();
        const crawlerAgent = new BrowserCrawlerAgent(browser);

        this.setUpConfig([
            {
                model: 'gpt-4-0125-preview',
                systemMessage: {
                    role: agetInstructions,
                    'Task': `Perform the following task: {{task}}`,
                },
                stepType: StepType.EXECUTION,
                tools: [
                    {
                        toolDefinition: {
                            type: 'function',
                            function: {
                                name: 'navigation_agent',
                                description: 'Get instructions for the agent',
                                parameters: {
                                    type: "object",
                                    properties: {
                                        instructions: {
                                            type: "string",
                                            description: "Navigation instructions for the agent"
                                        },
                                        expectedDestination: {
                                            type: "string",
                                            description: "What is the expected destination of the navigation"
                                        }
                                    },
                                    required: ['instructions', 'expectedDestination']
                                },
                            },
                        },
                        callback: async (params) => {
                            const { instructions, expectedDestination } = params;
                            const task = `${instructions} until you find: ${expectedDestination}`;
                            console.log(task);
                            const taskResult = await crawlerAgent.runTask(task) as any;
                            const { success, conclusion } = taskResult;
                            this.messagesHistory.push({
                                role: 'assistant',
                                content: `Navigation task: ${task} was ${success ? 'successful' : 'unsuccessful'}. ${conclusion}`
                            });
                        }
                    },
                    contentExtractionTool(this, browser),
                    {
                        toolDefinition: {
                            type: 'function',
                            function: {
                                name: 'form_filling_agent',
                                description: 'Get instructions for the agent',
                                parameters: {
                                    type: "object",
                                    properties: {
                                        instructions: {
                                            type: "string",
                                            description: "Form filling instructions for the agent"
                                        }
                                    },
                                    required: ['instructions']
                                },
                            },
                        },
                        callback: async (params) => {
                            
                        }
                    },
                    promptUserTool(this),
                    finishTool
                ]
            },
            getEvaluateResultStep(this, {
                userMessageFactory: browserSomUMF.bind(browser),
                model: 'gpt-4-vision-preview'
            })
        ]);
    }
}