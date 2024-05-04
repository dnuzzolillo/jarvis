import readline from 'readline';
import { Agent, Tool } from '../../../agent';

function promptUserWithCmd(prompt: string): Promise<string> {
    console.log('\x1b[36m%s\x1b[0m', prompt);
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


export const promptUserTool = ((context: Agent): Tool => ({
    toolDefinition: {
        type: 'function',
        function: {
            name: 'prompt_user',
            description: 'Prompt the user with a message',
            parameters: {
                type: "object",
                properties: {
                    prompt: {
                        type: "string",
                        description: "Prompt to show to the user",
                    },
                },
                required: ['prompt']
            }
        },
    },
    callback: async (params: Record<string, string>) => {
        const userInput: string = await promptUserWithCmd(params.prompt);
        context.messagesHistory.push({
            role: "user",
            content: userInput
        });
    }
}))