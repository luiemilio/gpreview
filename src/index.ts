import * as path from 'node:path';
import { Input, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { Page, Response, firefox } from 'playwright';
import 'dotenv/config';

type MetaInfo = {
    description: string;
    url: string;
    photo: string;
    video?: string;
};

const initPage = async (): Promise<Page> => {
    const browser = await firefox.launch();
    return browser.newPage();
};

const navigate = (page: Page, url: string): Promise<Response> => {
    return page.goto(url, { timeout: 10000, waitUntil: 'load' });
};

const parseMetaInfo = async (page: Page, url: string): Promise<MetaInfo> => {
    try {
        const description = await page.locator('meta[property="og:description"]').getAttribute('content');
        const photo = await page.locator('meta[property="og:image"]').getAttribute('content');

        try {
            await page.waitForSelector('video', { timeout: 1000 });
            const videoLocator = page.locator('video');
            const video = await videoLocator.getAttribute('src');

            return {
                url,
                description,
                photo,
                video
            };
        } catch (error) {
            //
        }

        return { url, description, photo };
    } catch (error) {
        console.error(error);
    }
};

(async (): Promise<void> => {
    try {
        const page = await initPage();
        const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));

        bot.on(message('text'), async (ctx): Promise<void> => {
            const {
                update: {
                    message: { text }
                }
            } = ctx;

            if (text.toLowerCase().includes('instagram.com')) {
                try {
                    const imgPath = path.join(__dirname, '..', 'loading.png');
                    const waitMsg = await ctx.replyWithPhoto(Input.fromLocalFile(imgPath), {
                        caption: 'Loading IG preview...'
                    });
                    const { href, searchParams } = new URL(text);
                    await navigate(page, href);
                    const { url, photo, video, description } = await parseMetaInfo(page, href);
                    const caption = `${url}\n${description}`;
                    const spoiler = searchParams.has('spoiler');

                    await ctx.telegram.editMessageMedia(ctx.chat.id, waitMsg.message_id, null, {
                        media: video ?? photo,
                        type: video ? 'video' : 'photo',
                        caption,
                        has_spoiler: spoiler
                    });
                } catch (error) {
                    console.error(error);
                }
            }
        });

        await bot.launch();
    } catch (error) {
        console.error(error);
    }
})();
