import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { Page, Response, firefox } from 'playwright';
import type { Context } from 'telegraf';

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
            await page.waitForSelector('video', { timeout: 3000 });
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

const showPreview = async (url: string, ctx: Context, page: Page, spoiler = false): Promise<void> => {
    const waitMsg = await ctx.reply('Loading IG preview...');

    try {
        await navigate(page, url);
        const { photo, video, description } = await parseMetaInfo(page, url);
        const caption = `${url}\n${description}`;

        if (video) {
            await ctx.replyWithVideo(video, { caption, has_spoiler: spoiler });
        } else {
            await ctx.replyWithPhoto(photo, { caption, has_spoiler: spoiler });
        }
    } catch (error) {
        console.error(error.stack);
    } finally {
        await ctx.deleteMessage(waitMsg.message_id);
    }
};

const isValidUrl = (str: string): boolean => {
    try {
        const urlObj = new URL(str);
        return urlObj.origin.includes('instagram.com');
    } catch (error) {
        return false;
    }
};

(async (): Promise<void> => {
    try {
        const page = await initPage();
        const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));

        bot.on(message('text'), async (ctx): Promise<void> => {
            try {
                const {
                    update: {
                        message: { text }
                    }
                } = ctx;

                if (text.startsWith('/spoiler ')) {
                    const url = text.split(' ')[1];

                    if (isValidUrl(url)) {
                        await showPreview(url, ctx, page, true);
                    }
                } else {
                    if (isValidUrl(text)) {
                        await showPreview(text, ctx, page);
                    }
                }
            } catch (error) {
                console.error(
                    `Error while trying to handle message id: ${ctx.message.message_id}.\nText: ${ctx.update.message.text}\n${error.stack}`
                );
            }
        });

        await bot.launch();
    } catch (error) {
        console.error(error.stack);
    }
})();
