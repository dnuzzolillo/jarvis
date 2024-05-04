import { Agent, Step, StepFrequency, StepType } from "../../agent"

const evaluateSystemPrompt = {
    Role: `You are an AI agent who's is performing a task step by step, your job is to evaluate the current state of the execution and provide a feedback.`,
    'Response Format': `You only speak JSON, and you must provide the following fields:
    - feedback_type: The type of feedback you want to provide. It can be one of the following: 'positive', 'negative' or 'neutral'
    - feedback_message: The message you want to provide to the AI agent.`,
    'Example response': `\`\`\`json
    {
        "feedback_type": "negative",
        "feedback_message": "The ai agent is stuck in a loop, it keeps repeating the same action over and over again."
    }
    \`\`\``,
    task: `The AI agent is performing the following task: {{task}}`,
}

export const getEvaluateResultStep = (context: Agent, override: Partial<Step> = {}): Step => {
    return {
        stepType: StepType.THINKING,
        systemMessage: evaluateSystemPrompt,
        model: 'gpt-4-0125-preview',
        frequency: StepFrequency.EVERY,
        frequencyParam: 1,
        callback: async (response: string) => {
            console.log('feedback', response);
            const JSONstring = Agent.extractJsonFromString(response);
            const parsedResponse = JSON.parse(JSONstring);
            context.messagesHistory.push({
                role: 'user',
                content: 'Feedback: '+parsedResponse.feedback_message
            });
            context.feedbackHistory.push(parsedResponse);
        },
        ...override
    } as Step
}