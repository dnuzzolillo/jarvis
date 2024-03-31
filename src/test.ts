import { BrowserController } from "./browser";
import playwright from 'playwright';

(async () => {
    (async () => {   
        const browser = await playwright.chromium.connectOverCDP('http://localhost:9222');
        const context = await browser.contexts()[0];
        const page = await context.newPage();
        page.goto('https://youtube.com');
        

    })();
})()