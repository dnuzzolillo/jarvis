import { BrowserContext, Page, Browser, chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
// import dotenv from 'dotenv';
import dotenv from 'dotenv';
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

    async type(elementId: string, text: string, pressEnter: boolean = false): Promise<void> {
        const page = await this.getPage();
        await this.click(elementId);
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

    async scroll(direction: 'up' | 'down'): Promise<void> {
        const page = await this.getPage();
        switch (direction) {
            case 'up':
                await page.mouse.wheel(0, -700);
                break;
            case 'down':
                await page.mouse.wheel(0, 700);
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
            await (await this.getPage()).waitForLoadState(state , {
                timeout: 6000
            })
        } catch (error) {
            return;
        }
    }

    async applySom() {
        let attempts = 0;
        while (attempts < 3) {
            try {
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
            } catch (error) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }
        }
        
    }

    async takeScreenshot(): Promise<string | null> {
        const page = await this.getPage();
        //get xmlMap
        const xmlMap = await this.applySom();
        await page.screenshot({ path: 'screenshot.png' });
        return xmlMap;
    }
}