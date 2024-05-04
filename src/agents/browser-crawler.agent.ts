import { Agent, StepFrequency, StepType } from "../agent";
import { BrowserController } from "../browser";
import { getEvaluateResultStep } from "./steps";
import { getCrawlingStep } from "./steps/crawling.step";
import { getPlanningStep } from "./steps/planning.step";
import { navigateTool } from "./steps/tools";
import { browserSomUMF } from "./steps/user-message-fatories";

const crawlingAgentRole = `You are an AI agent who\'s job is to operate a web browser and only focuses to crawl the web and navigate to the expected destination.`;

export class BrowserCrawlerAgent extends Agent {
    
    constructor(public browser: BrowserController) {
        super([]);
        this.updateRecords({
            role: crawlingAgentRole,
        });
        this.setUpConfig([
            getPlanningStep(this),
            {
                systemMessage: {
                    role: '{{role}}',
                    'Expected response': `Think a url to start crawling the web and use the navigate tool to navigate to the URL.`,
                    'Task': `Perform the following task: {{task}}`,
                },
                stepType: StepType.EXECUTION,
                frequency: StepFrequency.IF,
                frequencyParam: () => !this.browser.page,
                tools: [
                    navigateTool(this.browser),
                ],
            },
            getCrawlingStep(this.browser),
            getEvaluateResultStep(this, {
                userMessageFactory: browserSomUMF.bind(browser),
                model: 'gpt-4-vision-preview'
            })
        ])
    }

}