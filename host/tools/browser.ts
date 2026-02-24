import puppeteer, { Browser } from 'puppeteer';
import { ToolManifest, ToolHandler, ToolResult } from '../../tools/types';

let activeBrowser: Browser | null = null;

export function createBrowserTool(): { manifest: ToolManifest, handler: ToolHandler } {
    return {
        manifest: {
            name: 'host.web.browser',
            description: 'Navigate to a URL and rigorously extract textual content natively via Puppeteer.',
            parameters: { url: 'string' }
        },
        handler: async (agentId: string, args: any): Promise<ToolResult> => {
            try {
                if (!args.url || typeof args.url !== 'string') {
                    return { kind: 'ERROR', message: 'Missing or invalid URL strictly required.' };
                }

                if (!activeBrowser) {
                    activeBrowser = await puppeteer.launch({ headless: true });
                }

                const page = await activeBrowser.newPage();
                await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 8000 });

                const content = await page.evaluate(() => {
                    return document.body.innerText.substring(0, 2000); // Truncate rigorously to preserve context limits
                });

                await page.close();

                return { kind: 'SUCCESS', data: content };
            } catch (e: any) {
                return { kind: 'ERROR', message: `BROWSER_ERROR: ${e.message}` };
            }
        }
    };
}

export async function closeBrowser() {
    if (activeBrowser) {
        await activeBrowser.close();
        activeBrowser = null;
    }
}
