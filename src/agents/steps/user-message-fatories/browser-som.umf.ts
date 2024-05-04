import fs from 'fs';
import { ChatCompletionContentPart } from "openai/resources";
import { BrowserController } from '../../../browser';

async function imageToBase64(image_file: any) {
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

// TODO: change this name to something more meaningful
export async function browserSomUMF() {
    // @ts-ignore
    const xamlMap = await (this as BrowserController).takeScreenshot();
    const base64: any = await imageToBase64('screenshot.png');
    const userMessage: Array<ChatCompletionContentPart> = [
        {
            "type": "image_url",
            "image_url": base64,
        },
        {
            "type": "text",
            // @ts-ignore
            "text": `current url: ${(this as BrowserController).page?.url()}`,
        },
        {
            "type": "text",
            "text": `UI map: ${xamlMap}`,
        }
    ]
    return userMessage;
}