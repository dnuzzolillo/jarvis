import { BrowserContext, Page, Browser, chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
// import dotenv from 'dotenv';
import dotenv from 'dotenv';
import { Observable } from 'rxjs';
dotenv.config();
const rootPath: string = path.resolve(__dirname, '..');
const contextPath: string = rootPath + "/temp/browser";
const cookiesExtensionPath: string = rootPath + "/cookies-extension";

export class BrowserController {
    static browser: Browser | undefined;
    static async getBrowser() {
        if (!BrowserController.browser) {
            BrowserController.browser = await chromium.connectOverCDP('http://localhost:9222');
        }
        return BrowserController.browser;
    }
    static context: BrowserContext | undefined;
    static async getContext() {
        if (!BrowserController.context) {
            BrowserController.context = await (await BrowserController.getBrowser()).contexts()[0];
        }
        return BrowserController.context;
    }

    page: Page | undefined;

    jsonMap: Record<string, {
        left: number;
        top: number;
        width: number;
        height: number;
    }> = {};

    // set up observable with a
    jsonMapChanged$: Observable<Record<string, {
        left: number;
        top: number;
        width: number;
        height: number;
    }>> = new Observable();

    constructor(private initialUrl: string = 'https://www.google.com') {}

    async getPage() {
        if (!this.page) {
            this.page = await (await BrowserController.getContext()).newPage();
            await this.page.setViewportSize({ width: 1080, height: 720 });
            this.navigate(this.initialUrl);
        }
        return this.page;
    }

    async navigate(url: string): Promise<void> {
        if(!this.page) {
            this.initialUrl = url;
            return;
        }
        const page = await this.getPage();
        await page.goto(url.includes('://') ? url : `https://${url}`, { timeout: 60000 });
        await page.waitForLoadState('load');
    }

    async type(elementId: string, text: string, {pressEnter, replaceExisting}: {pressEnter?: boolean, replaceExisting?: boolean} = {}): Promise<void> {
        const page = await this.getPage();
        await this.click(elementId);
        if(replaceExisting) {
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
        }
        for (let i = 0; i < text.length; i++) {
            // trasform character with special keys like á, é, í, ó, ú
            const specialKeys: Record<string, string> = {
                'á': 'a',
                'é': 'e',
                'í': 'i',
                'ó': 'o',
                'ú': 'u',
                'ñ': 'n'
            };
            try {
                await page.keyboard.press(specialKeys[text[i].toLowerCase()] || text[i]);
            } catch (error) {
                // do nothing
            }
        }
        if (pressEnter) {
            await page.keyboard.press('Enter');
        }

        await this.awaitForState();

    }

    async click(elementId: string): Promise<void> {
        const page = await this.getPage();
        await page.evaluate(() => {
            const links = document.querySelectorAll('a');
            links.forEach(link => {
                link.setAttribute('target', '_self');
            });
        });
        //const selector = `[v-id="${elementId.toLowerCase()}"]`;
        const { left, top, width, height } = this.jsonMap[elementId];
        const x = left + (width / 2);
        const y = top + (height / 2);
        await page.mouse.click(x, y);
        await this.awaitForState();
    }

    async scroll(direction: 'up' | 'down', elementId: string): Promise<void> {
        const page = await this.getPage();
        // move to element
        const { left, top, width, height } = elementId === 'body' ? { left: 0, top: 0, width: 1080, height: 720 } : this.jsonMap[elementId];
        const x = left + (width / 2);
        const y = top + (height / 2);
        await page.mouse.move(x, y);
        // scroll
        // calculate scroll amount (90% of the height of the element)
        const scrollAmount = height * 0.9;
        switch (direction) {
            case 'up':
                await page.mouse.wheel(0, -scrollAmount);
                break;
            case 'down':
                await page.mouse.wheel(0, scrollAmount);
                break;
            default:
                throw new Error('Invalid direction ' + direction);
        }

    }

    async goBack() {
        const page = await this.getPage();
        await page.goBack();
    }

    async awaitForState(state: 'load' | 'networkidle' = 'networkidle') {
        // await for network idle
        try {
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
            return;
        }
    }

    async attemptPromise<T>(promise: () => Promise<T>, attempts: number = 3): Promise<T> {
        let error: Error | null = null;
        for (let i = 0; i < attempts; i++) {
            try {
                return await promise.bind(this)();
            } catch (e: any) {
                console.log('Error', e);
                error = e;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        throw error;
    }

    async applySom() {
        const page = await this.getPage();
        //inject style
        const style = fs.readFileSync(__dirname + '/som.css', 'utf8');
        await page.addStyleTag({ content: style });
        //inject script
        const scriptContent = fs.readFileSync(__dirname + '/som.js', 'utf8');
        await page.evaluate(script => eval(script), scriptContent);

        const xmlMap = await page.evaluate(() => {
            const xmlMap = (window as any).xmlMap;
            return xmlMap;
        });

        this.jsonMap = await page.evaluate(() => {
            const jsonMap = (window as any).jsonMap;
            return jsonMap;
        });
        return xmlMap;
    }

    async remmoveSom() {
        const page = await this.getPage();
        await page.evaluate(() => {
            const jsonMap = (window as any).removeSom();
            return jsonMap;
        });
    }

    async takeScreenshot(): Promise<string | null> {
        const page = await this.getPage();
        //get xmlMap
        const xmlMap = await this.attemptPromise(this.applySom, 3);
        await page.screenshot({ path: 'screenshot.png' });
        await this.attemptPromise(this.remmoveSom, 3);
        return xmlMap;
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

    async takeFullPageScreenshot(): Promise<string[]> {
        //take a screenshot of the full page and divide it in parts
        const page = await this.getPage();

        const { height } = await this.attemptPromise< { height: number } >(async () => {
            return await page.evaluate(() => {
                return {
                    height: document.documentElement.offsetHeight,
                };
            });
        }, 3)
        let viewportHeightOffset = 0;
        const viewportHeightOffsetStep = 720;
        const viewportWidthOffsetStep = 1080;
        const screenshotParts: string[] = [];
        let chunk = 0;
        while (viewportHeightOffset < height) {
            const scrollAmount = viewportHeightOffset + viewportHeightOffsetStep;
            const reachedEnd = scrollAmount > height;
            const screenshot = await page.screenshot({
                fullPage: true,
                clip: {
                    x: 0,
                    y: viewportHeightOffset,
                    width: viewportWidthOffsetStep,
                    height: reachedEnd ? height - viewportHeightOffset : viewportHeightOffsetStep,
                },
            });
            screenshotParts.push(screenshot.toString('base64'));
            viewportHeightOffset += viewportHeightOffsetStep;
            chunk++;
        }
        return screenshotParts;
    }
}