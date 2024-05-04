export const executionStepReasoningPropDefinition = {
    analysis: {
        type: "string",
        description: "Create a brief analysis of what you learned",
    },
    expectedResults: {
        type: "string",
        description: "What are the expected results of this action?",
    },
    nextSteps: {
        type: "string",
        description: "What are the next steps to take after this action?",
    }
}