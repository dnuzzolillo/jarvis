import { Agent, StepFrequency, StepType } from "../../agent";

const planningStepSystemPrompt = {
    'Role': '{{role}}',
    'Task': `Given task: {{task}}`,
    'Expected response': `You have to analyze the given task and provide a concise plan to perform the task.`,
}

export const getPlanningStep = (context: Agent) => {
    return {
        stepType: StepType.THINKING,
        systemMessage: planningStepSystemPrompt,
        model: 'gpt-4-turbo-2024-04-09',
        frequency: StepFrequency.FIRST,
        callback: (response: string) => {
            context.updateRecords({
                plan: response
            })
        },
    }
}