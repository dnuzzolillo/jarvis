import { Step, StepFrequency, StepType } from "../../agent"
import { BrowserController } from "../../browser"
import { getBrwoserCrawlingTools, finishTool } from "./tools"
import { browserSomUMF } from "./user-message-fatories";

export const getCrawlingStep = (browser: BrowserController): Step => {
    return {
        stepType: StepType.EXECUTION,
        systemMessage: {
            'Role': '{{role}}',
            'Task': `Given task: {{task}}`,
            'How you operate': `You are given a screenshot of the browser with a set of marks that indicates the elements to interact with.`,
            'Expected response': `Yo have to analyze the UI and choose the next tool to use to perform the task.`,
            'finish': 'Once you have completed the task, you should use the finish tool to finish the task.',
        },
        model: 'gpt-4-vision-preview',
        frequency: StepFrequency.EVERY,
        frequencyParam: 1,
        tools: [
            ...getBrwoserCrawlingTools(browser),
            finishTool,
        ],
        userMessageFactory: browserSomUMF.bind(browser),
    
    }
}