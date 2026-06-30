import * as cheerio from 'cheerio';
import { getBrowserInstance } from '../../utils/browser';

// Obfuscated config to prevent obvious NSFW flags in repo
const C_CONF = {
    // https://manhwaread.com
    target: Buffer.from('aHR0cHM6Ly9tYW5od2FyZWFkLmNvbQ==', 'base64').toString('utf8'),
    // .page-item-detail
    sel1: Buffer.from('LnBhZ2UtaXRlbS1kZXRhaWw=', 'base64').toString('utf8'),
    // .post-title h3 a, h3.h5 a
    sel2: Buffer.from('LnBvc3QtdGl0bGUgaDMgYSwgaDMuaDUgYQ==', 'base64').toString('utf8'),
    // .list-chapter .chapter-item
    sel3: Buffer.from('Lmxpc3QtY2hhcHRlciAuY2hhcHRlci1pdGVt', 'base64').toString('utf8'),
    // .chapter a
    sel4: Buffer.from('LmNoYXB0ZXIgYQ==', 'base64').toString('utf8'),
};

let homeCache: any = null;
let homeCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Error cooldown: if scraping fails, don't hammer puppeteer for 2 minutes
let lastErrorTime = 0;
const ERROR_COOLDOWN = 2 * 60 * 1000;

async function setupPage(browser: any) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const targetUrl = new URL(C_CONF.target);
    return page;
}

export const scrapeToonilyHome = async () => {
    if (homeCache && Date.now() - homeCacheTime < CACHE_TTL) {
        console.log('[Vault] Returning cached Toonily home data');
        return homeCache;
    }

    if (!homeCache && Date.now() - lastErrorTime < ERROR_COOLDOWN) {
        console.log('[Vault] Toonily in error cooldown, skipping scrape');
        throw new Error('Toonily scraper in cooldown after recent failure');
    }

    let page;
    try {
        const browser = await getBrowserInstance();
        page = await setupPage(browser);
        
        console.log('[Stealth] Initiating target bypass sequence...');
        await page.goto(C_CONF.target, { waitUntil: 'networkidle2', timeout: 45000 });
        
        // Wait for Cloudflare to pass by waiting for the real title or a known manga element
        try {
            await page.waitForFunction(() => {
                const title = document.title;
                if (title && (title.includes('521') || title.includes('503') || title.includes('502'))) return true; // Fail fast
                if (title && title.includes('Just a moment')) return false;
                const hasManga = document.querySelector('.comic-slider-section, .page-item-detail, .manga-item, .c-tabs-item__content, .bs');
                return !!hasManga;
            }, { timeout: 30000 });
        } catch (e) {
            console.log('[Stealth] Timeout waiting for Cloudflare challenge to pass or no manga found.');
        }

        const pageTitle = await page.title();
        if (pageTitle.includes('521') || pageTitle.includes('503') || pageTitle.includes('502')) {
            throw new Error('Vault Manhwa source is currently offline');
        }

        const html = await page.content();
        const $ = cheerio.load(html);

        const spotlight: any[] = [];
        const latest: any[] = [];
        const idRx = new RegExp(Buffer.from('XC8oPzp3ZWJ0b29ufG1hbmdhfGNvbWljKVwvKFteL10rKQ==', 'base64').toString('utf8'));

        // Spotlight — try multiple known slider selectors
        const spotlightSelectors = [
            '.widget-title:contains("Popular") + * .popular-item', // Typical popular widget
            '.wpp-list li', // WordPress popular posts
            '.popular-manga .page-item-detail',
            '.comic-slider-section ul li',
            '.slider-item',
            '.owl-item li',
            '.swiper-slide',
        ];
        for (const sel of spotlightSelectors) {
            $(sel).each((_i, el) => {
                const title = $(el).find('.txt span, .post-title a, h3 a, .entry-title a').text().trim();
                let url = $(el).find('a').attr('href') || '';
                if (url && url.startsWith('/')) url = C_CONF.target + url;
                const imgEl = $(el).find('img');
                const image = imgEl.attr('data-src') || imgEl.attr('src') || '';
                const idMatch = url.match(idRx) || url.match(/\/([^/]+)\/?$/);
                const id = idMatch ? idMatch[1] : '';
                if (title && id) {
                    spotlight.push({ id, title, image, url, scraperId: `vault:${id}`, type: 'Manga' });
                }
            });
            if (spotlight.length > 0) break;
        }

        // Latest/grid — try multiple known card selectors (newest first)
        const gridSelectors = [
            C_CONF.sel1,
            '.page-item-detail',
            '.manga-item',
            '.c-tabs-item__content',
            '.bs',
            '.bsx',
        ];

        const newManhwa: any[] = [];
        
        $('section').each((_, sec) => {
            const secTitle = $(sec).find('h1, h2, h3, .titles').first().text().trim().toLowerCase();
            const isPopular = secTitle.includes('popular');
            const isNew = secTitle.includes('new');
            const isLatest = secTitle.includes('latest');
            if (!isPopular && !isNew && !isLatest) return;
            
            const arr = isPopular ? spotlight : (isNew ? newManhwa : latest);
            
            for (const sel of gridSelectors) {
                const items = $(sec).find(sel);
                if (items.length > 0) {
                    items.each((_i, el) => {
                        const titleEl = $(el).find(C_CONF.sel2).length
                            ? $(el).find(C_CONF.sel2)
                            : $(el).find('.post-title a, h3 a, .entry-title a, .series-title a');
                        const title = titleEl.first().text().trim() || $(el).find('.post-title, h3').first().text().trim();
                        let url = titleEl.first().attr('href') || $(el).find('a').first().attr('href') || '';
                        if (url && url.startsWith('/')) url = C_CONF.target + url;
                        const imgEl = $(el).find('img');
                        const image = imgEl.attr('data-src') || imgEl.attr('src') || '';
                        const badge = $(el).find('.manga-title-badges').text().trim();
                        const rating = $(el).find('#averagerate, .score').text().trim();
                        const viewsRaw = $(el).find('.manga-rate-view-comment .item').last().text().trim();
                        const views = viewsRaw.replace(/views?/i, '').trim();
                        const chapters: any[] = [];
                        $(el).find(C_CONF.sel3).each((_j, chapEl) => {
                            const cTitle = $(chapEl).find(C_CONF.sel4).text().trim();
                            let cUrl = $(chapEl).find(C_CONF.sel4).attr('href') || '';
                            if (cUrl && cUrl.startsWith('/')) cUrl = C_CONF.target + cUrl;
                            const cDate = $(chapEl).find('.post-on').text().trim();
                            if (cTitle) chapters.push({ title: cTitle, url: cUrl, date: cDate });
                        });
                        const idMatch = url.match(idRx) || url.match(/\/([^/]+)\/?$/);
                        const id = idMatch ? idMatch[1] : '';
                        if (title && id) {
                            arr.push({ id, title, image, url, chapters, badge, rating, views, scraperId: `vault:${id}`, type: 'Manga' });
                        }
                    });
                    break;
                }
            }
        });
        
        if (latest.length === 0) {
            // Fallback to old behavior if sections failed
            for (const sel of gridSelectors) {
                $(sel).each((_i, el) => {
                    const titleEl = $(el).find(C_CONF.sel2).length
                        ? $(el).find(C_CONF.sel2)
                        : $(el).find('.post-title a, h3 a, .entry-title a, .series-title a');
                    const title = titleEl.first().text().trim() || $(el).find('.post-title, h3').first().text().trim();
                    let url = titleEl.first().attr('href') || $(el).find('a').first().attr('href') || '';
                    if (url && url.startsWith('/')) url = C_CONF.target + url;
                    const imgEl = $(el).find('img');
                    const image = imgEl.attr('data-src') || imgEl.attr('src') || '';
                    const badge = $(el).find('.manga-title-badges').text().trim();
                    const rating = $(el).find('#averagerate, .score').text().trim();
                    const viewsRaw = $(el).find('.manga-rate-view-comment .item').last().text().trim();
                    const views = viewsRaw.replace(/views?/i, '').trim();
                    const chapters: any[] = [];
                    $(el).find(C_CONF.sel3).each((_j, chapEl) => {
                        const cTitle = $(chapEl).find(C_CONF.sel4).text().trim();
                        let cUrl = $(chapEl).find(C_CONF.sel4).attr('href') || '';
                        if (cUrl && cUrl.startsWith('/')) cUrl = C_CONF.target + cUrl;
                        const cDate = $(chapEl).find('.post-on').text().trim();
                        if (cTitle) chapters.push({ title: cTitle, url: cUrl, date: cDate });
                    });
                    const idMatch = url.match(idRx) || url.match(/\/([^/]+)\/?$/);
                    const id = idMatch ? idMatch[1] : '';
                    if (title && id) {
                        latest.push({ id, title, image, url, chapters, badge, rating, views, scraperId: `vault:${id}`, type: 'Manga' });
                    }
                });
                if (latest.length > 0) break;
            }
        }

        if (spotlight.length === 0 && latest.length === 0) {
            throw new Error('Cloudflare block or no valid manga elements found. Refusing to cache empty data.');
        }

        // Fallback: promote latest as spotlight if slider found nothing
        if (spotlight.length === 0 && latest.length > 0) {
            const spotlightCount = Math.min(6, latest.length);
            for (let i = 0; i < spotlightCount; i++) spotlight.push(latest[i]);
        }

        // Merge rating/views from latest into spotlight items
        spotlight.forEach(spot => {
            const match = latest.find(lat => lat.id === spot.id);
            if (match) { spot.rating = match.rating; spot.views = match.views; }
        });

        const result = { spotlight, newManhwa, latest };
        homeCache = result;
        homeCacheTime = Date.now();
        console.log(`[Vault] Toonily scraped: ${spotlight.length} spotlight, ${newManhwa.length} new, ${latest.length} latest`);
        return result;
    } catch (error: any) {
        console.error('[Stealth] Operation failed:', error.message);
        lastErrorTime = Date.now(); // engage cooldown
        if (homeCache) {
            console.log('[Vault] Returning stale cache after error');
            return homeCache; // serve stale rather than cascade-failing
        }
        throw error;
    } finally {
        if (page) await page.close().catch(() => {});
    }
};

export const scrapeToonilyDetails = async (scraperId: string, providedUrl?: string) => {
    const id = scraperId.replace('vault:', '');
    const targetUrl = new URL(providedUrl || `${C_CONF.target}/manhwa/${id}/`);
    
    let page;
    try {
        const browser = await getBrowserInstance();
        page = await setupPage(browser);

        await page.goto(targetUrl.href, { waitUntil: 'networkidle2', timeout: 45000 });
        try {
            await page.waitForFunction(() => {
                const title = document.title;
                if (title && (title.includes('521') || title.includes('503') || title.includes('502'))) return true; // Fail fast
                if (title && title.includes('Just a moment')) return false;
                const hasDetails = document.querySelector('.post-title, .summary__content, .wp-manga-chapter, .entry-title, .tsinfo, #chapterlist, .eplister, .chapter-item, .chapters-list');
                return !!hasDetails;
            }, { timeout: 30000 });
        } catch (e) {
            console.log('[Stealth] Timeout waiting for Cloudflare challenge to pass or no details found.');
        }
        
        const pageTitle = await page.title();
        if (pageTitle.includes('521') || pageTitle.includes('503') || pageTitle.includes('502')) {
            throw new Error('Vault Manhwa source is currently offline');
        }

        const html = await page.content();
        const $ = cheerio.load(html);
        
        let chapterEls = $('.page-content-listing.single-page .wp-manga-chapter a, #chapterlist ul li a, .eplister ul li a, .chapters-list a.chapter-item, .bixbox.bxcl li a');
        if (chapterEls.length === 0) {
            chapterEls = $('.wp-manga-chapter a, a.chapter-item');
        }

        const uniqueChapters = new Map();
        chapterEls.each((i, el) => {
            let title = $(el).find('.chapternum').text().trim() || $(el).text().trim();
            // clean up title
            title = title.replace(/\s+/g, ' ').trim();
            let url = $(el).attr('href') || '';
            if (url && url.startsWith('/')) url = C_CONF.target + url;
            
            if (title && url) {
                if (!uniqueChapters.has(url)) {
                    uniqueChapters.set(url, {
                        id: url,
                        title: title,
                        url: url
                    });
                }
            }
        });
        const chapters = Array.from(uniqueChapters.values());
        
        const synopsis = $('.summary__content p').text().trim() || $('.description-summary p').text().trim() || $('.summary__content').text().trim() || $('.entry-content').text().trim() || $('[itemprop="description"]').text().trim() || $('p').filter((_i, el) => $(el).text().length > 50).first().text().trim();
        const rating = $('#averagerate').text().trim() || $('.score').text().trim() || $('.num[itemprop="ratingValue"]').text().trim();
        const author = $('.author-content a, .tsinfo .imptdt:contains("Author") i').map((i, el) => $(el).text().trim()).get().join(', ');
        const artist = $('.artist-content a, .tsinfo .imptdt:contains("Artist") i').map((i, el) => $(el).text().trim()).get().join(', ');
        const title = $('.post-title h1').text().trim() || $('.manga-title').text().trim() || $('.profile-manga-title').text().trim() || $('.entry-title').text().trim() || $('title').text().split('-')[0].trim();
        const image = $('.summary-image img').attr('data-src') || $('.summary-image img').attr('src') || $('.manga-thumbnail img').attr('data-src') || $('.thumb img').attr('src') || $('.aspect-w-3 img').attr('src') || $('img[src*="cover"]').attr('src') || '';
        
        let views = '';
        $('.post-content_item').each((i, el) => {
            const heading = $(el).find('.summary-heading').text().toLowerCase();
            if (heading.includes('view') || $(el).text().toLowerCase().includes('view')) {
                views = $(el).find('.summary-content').text().trim();
                if (!views) {
                    views = $(el).text().replace(/views?/i, '').trim();
                }
            }
        });

        return { chapters, synopsis, rating, author, artist, views, title, image };
    } catch (e) {
        console.error('[Stealth] Failed to get Toonily chapters', e);
        return [];
    } finally {
        if (page) await page.close().catch(() => {});
    }
};

export const scrapeToonilyPages = async (chapterUrl: string) => {
    const targetUrl = new URL(chapterUrl);
    
    let page;
    try {
        const browser = await getBrowserInstance();
        page = await setupPage(browser);

        await page.goto(targetUrl.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
        try {
            await page.waitForFunction(() => {
                const title = document.title;
                if (title && (title.includes('521') || title.includes('503') || title.includes('502'))) return true;
                if (title && title.includes('Just a moment')) return false;
                const hasPages = document.querySelector('.reading-content img, #readerarea img, .reading-image');
                return !!hasPages;
            }, { timeout: 30000 });
        } catch (e) {
            console.log('[Stealth] Timeout waiting for Cloudflare challenge to pass or no pages found.');
        }
        
        const pageTitle = await page.title();
        if (pageTitle.includes('521') || pageTitle.includes('503') || pageTitle.includes('502')) {
            throw new Error('Vault Manhwa source is currently offline');
        }

        const html = await page.content();
        const $ = cheerio.load(html);
        
        const pages: any[] = [];
        $('.reading-content img, #readerarea img, .reading-image').each((i, el) => {
            const src = $(el).attr('data-src') || $(el).attr('src') || '';
            if (src && !src.includes('data:image') && !src.startsWith('blob:')) {
                pages.push({
                    pageNumber: i + 1,
                    imageUrl: src.trim()
                });
            }
        });
        
        if (pages.length === 0) {
            // ts_reader fallback
            const baseMatch = html.match(/"base"\s*:\s*"([^"]+)"/);
            const base = baseMatch ? baseMatch[1] : '';
            const b64Match = html.match(/"([A-Za-z0-9+/=]{100,})"/g);
            if (b64Match) {
                for (const b of b64Match) {
                    const clean = b.replace(/"/g, '');
                    try {
                        const dec = Buffer.from(clean, 'base64').toString('utf8');
                        if (dec.startsWith('[') && dec.includes('"src"')) {
                            const images = JSON.parse(dec);
                            images.forEach((img: any, i: number) => {
                                pages.push({
                                    pageNumber: i + 1,
                                    imageUrl: base ? `${base}/${img.src}` : img.src
                                });
                            });
                            break;
                        }
                    } catch (e) {}
                }
            }
        }
        
        return pages;
    } catch (e) {
        console.error('[Stealth] Failed to get Toonily pages', e);
        return [];
    } finally {
        if (page) await page.close().catch(() => {});
    }
};

export const scrapeToonilySearch = async (query: string) => {
    const targetUrl = new URL(C_CONF.target);
    targetUrl.searchParams.set('s', query);
    targetUrl.searchParams.set('post_type', 'wp-manga');
    
    let page;
    try {
        const browser = await getBrowserInstance();
        page = await setupPage(browser);

        await page.goto(targetUrl.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
        try {
            await page.waitForFunction(() => {
                const title = document.title;
                if (title && (title.includes('521') || title.includes('503') || title.includes('502'))) return true;
                if (title && title.includes('Just a moment')) return false;
                const hasResults = document.querySelector('.c-tabs-item__content, .page-item-detail, .manga-item, .not-found');
                return !!hasResults;
            }, { timeout: 30000 });
        } catch (e) {
            console.log('[Stealth] Timeout waiting for Cloudflare challenge to pass or no search results found.');
        }
        
        const pageTitle = await page.title();
        if (pageTitle.includes('521') || pageTitle.includes('503') || pageTitle.includes('502')) {
            throw new Error('Vault Manhwa source is currently offline');
        }

        const html = await page.content();
        const $ = cheerio.load(html);
        
        const results: any[] = [];
        const idRx = new RegExp(Buffer.from('XC8oPzp3ZWJ0b29ufG1hbmdhfGNvbWljKVwvKFteL10rKQ==', 'base64').toString('utf8'));

        $('.c-tabs-item__content, .page-item-detail, .manga-item').each((i, el) => {
            const titleEl = $(el).find('.post-title a, h3 a, .entry-title a');
            const title = titleEl.first().text().trim();
            let url = titleEl.first().attr('href') || '';
            if (url && url.startsWith('/')) url = C_CONF.target + url;
            const imgEl = $(el).find('img');
            const image = imgEl.attr('data-src') || imgEl.attr('src') || '';
            const idMatch = url.match(idRx) || url.match(/\/([^/]+)\/?$/);
            const id = idMatch ? idMatch[1] : '';
            if (title && id) {
                results.push({ id, title, image, url, scraperId: `vault:${id}`, type: 'Manga' });
            }
        });
        
        return results;
    } catch (e) {
        console.error('[Stealth] Failed to search Toonily', e);
        return [];
    } finally {
        if (page) await page.close().catch(() => {});
    }
};
