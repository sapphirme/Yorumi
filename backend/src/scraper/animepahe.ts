
import { Browser, Page } from 'puppeteer-core';
import { getBrowserInstance } from '../utils/browser';
import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://animepahe.pw';
const API_URL = 'https://animepahe.pw/api';
const MIRROR_BASE_URL = 'https://animepahe.ch';
const MIRROR_SESSION_PREFIX = 'apch:';

export interface AnimeSearchResult {
    id: string;
    title: string;
    url: string;
    poster?: string;
    status?: string;
    type?: string;
    episodes?: number;
    year?: string;
    score?: string;
    session: string; // Unified ID
}

export interface Episode {
    id: string;
    episodeNumber: number;
    url: string;
    title?: string;
    duration?: string;
    date?: string;
    snapshot?: string;
    session: string;
}

export interface LatestRelease {
    id: string;
    title: string;
    animeSession?: string;
    episodeSession?: string;
    episodeNumber: number;
    snapshot?: string;
    url: string;
    session?: string;
}

export interface StreamLink {
    quality: string;
    audio: string;
    provider?: string;
    server?: string;
    url: string; // The original embed URL
    directUrl?: string; // The resolved .m3u8 URL
    isHls: boolean;
}

export interface AnimeInfo {
    title: string;
    poster?: string;
    description?: string;
    status?: string;
    type?: string;
    episodes?: number | null;
    year?: number | null;
}

export class AnimePaheScraper {
    private browser: Browser | null = null;
    private readonly requestHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': '__ddg2_=;',
        'DNT': '1',
        'Referer': BASE_URL,
        'Sec-CH-UA': '"Not A(Brand";v="99", "Microsoft Edge";v="121", "Chromium";v="121"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'X-Requested-With': 'XMLHttpRequest',
    };
    private readonly EPISODE_FETCH_CONCURRENCY = 6;

    private isMirrorSession(value: unknown) {
        return String(value || '').startsWith(MIRROR_SESSION_PREFIX);
    }

    private toMirrorSlug(value: unknown) {
        return String(value || '')
            .replace(/^apch:/i, '')
            .trim()
            .toLowerCase()
            .replace(/['’]/g, '')
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    private mirrorEpisodePageUrl(slug: string, episodeNumber: number) {
        return `${MIRROR_BASE_URL}/${slug}-episode-${episodeNumber}-english-subbed/`;
    }

    private extractMirrorEmbedUrl(html: string) {
        const $ = cheerio.load(String(html || ''));
        const iframeSrc = $('iframe[src*="megaplay"]').first().attr('src')?.trim();
        if (iframeSrc) return iframeSrc;

        const encoded = $('select.mirror option[value]').map((_, option) => $(option).attr('value') || '').get()
            .find((value) => value);
        if (!encoded) return '';

        try {
            const decoded = Buffer.from(encoded, 'base64').toString('utf8');
            const match = decoded.match(/<iframe[^>]+src=["']([^"']+)["']/i);
            return match?.[1]?.trim() || '';
        } catch {
            return '';
        }
    }

    private async waitForChallengeBypass(page: Page, timeoutMs: number = 60000) {
        const startedAt = Date.now();

        while (Date.now() - startedAt < timeoutMs) {
            try {
                const challengeState = await page.evaluate(() => {
                    const title = String(document.title || '');
                    const bodyText = String(document.body?.innerText || '');
                    const normalized = `${title}\n${bodyText}`.toLowerCase();
                    const blocked =
                        normalized.includes('checking your browser before accessing animepahe.com') ||
                        normalized.includes('ddos-guard');
                    return {
                        blocked,
                        title,
                    };
                });

                if (!challengeState.blocked) {
                    return true;
                }
            } catch {
                // Keep polling until timeout
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        return false;
    }

    private async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await getBrowserInstance();
        }
        return this.browser;
    }

    private async fetchApiJson(url: string): Promise<any | null> {
        try {
            const response = await axios.get(url, {
                headers: this.requestHeaders,
                timeout: 7000,
                responseType: 'json',
            });
            return response.data ?? null;
        } catch (error) {
            return null;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async search(query: string): Promise<AnimeSearchResult[]> {
        const searchUrl = `${API_URL}?m=search&q=${encodeURIComponent(query)}`;

        const apiResponse = await this.fetchApiJson(searchUrl);
        if (apiResponse && Array.isArray(apiResponse.data)) {
            return apiResponse.data.map((item: any) => ({
                id: item.id,
                session: item.session,
                title: item.title,
                url: `/anime/${item.session}`,
                poster: item.poster,
                status: item.status,
                type: item.type,
                episodes: item.episodes,
                year: item.year,
                score: item.score
            }));
        }

        const mirrorSlug = this.toMirrorSlug(query);
        if (!mirrorSlug) return [];

        const mirrorProbe = await this.getEpisodes(`${MIRROR_SESSION_PREFIX}${mirrorSlug}`).catch(() => ({ episodes: [] }));
        if (!Array.isArray(mirrorProbe.episodes) || mirrorProbe.episodes.length === 0) return [];

        return [{
            id: mirrorSlug,
            session: `${MIRROR_SESSION_PREFIX}${mirrorSlug}`,
            title: query,
            url: `${MIRROR_BASE_URL}/${mirrorSlug}-episode-1-english-subbed/`,
            type: 'TV',
            episodes: mirrorProbe.episodes.length,
        }];
    }

    private mapLatestReleaseApiItems(items: any[]): LatestRelease[] {
        return (Array.isArray(items) ? items : []).flatMap((item: any) => {
            const title = String(item?.anime_title || item?.anime?.title || item?.title || '').trim();
            const animeSession = String(item?.anime_session || item?.anime?.session || item?.animeSession || '').trim();
            const episodeSession = String(item?.episode_session || item?.session || item?.episodeSession || '').trim();
            const episodeNumber = Number(item?.episode || item?.episode_number || item?.episodeNumber || 0);
            const snapshot = String(item?.snapshot || item?.image || item?.poster || '').trim();

            if (!title || !Number.isFinite(episodeNumber) || episodeNumber <= 0) return [];

            return [{
                id: `${animeSession || title}:${episodeSession || episodeNumber}`,
                title,
                animeSession,
                episodeSession,
                session: animeSession || undefined,
                episodeNumber,
                snapshot: snapshot || undefined,
                url: animeSession && episodeSession ? `/play/${animeSession}/${episodeSession}` : '',
            }];
        });
    }

    async getLatestReleases(pageNum: number = 1): Promise<{
        data: LatestRelease[];
        pagination: {
            current_page: number;
            last_visible_page: number;
            has_next_page: boolean;
        };
    }> {
        const safePage = Math.max(1, Math.floor(Number(pageNum) || 1));
        const apiUrls = [
            `${API_URL}?m=airing&page=${safePage}`,
            `${API_URL}?m=latest&page=${safePage}`,
            `${API_URL}?m=release&page=${safePage}&sort=episode_desc`,
        ];

        for (const url of apiUrls) {
            const payload = await this.fetchApiJson(url);
            const data = this.mapLatestReleaseApiItems(payload?.data);
            if (data.length > 0) {
                const lastPage = Number(payload?.last_page || payload?.lastPage || safePage) || safePage;
                return {
                    data,
                    pagination: {
                        current_page: Number(payload?.current_page || safePage) || safePage,
                        last_visible_page: lastPage,
                        has_next_page: Boolean(payload?.next_page_url) || safePage < lastPage,
                    },
                };
            }
        }

        return this.getLatestReleasesFromHtml(safePage);
    }

    private async getLatestReleasesFromHtml(pageNum: number): Promise<{
        data: LatestRelease[];
        pagination: {
            current_page: number;
            last_visible_page: number;
            has_next_page: boolean;
        };
    }> {
        const pageUrl = `${BASE_URL}${pageNum > 1 ? `?page=${pageNum}` : ''}`;
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent(this.requestHeaders['User-Agent']);

        try {
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['stylesheet', 'font', 'media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await this.waitForChallengeBypass(page, 30000);
            const html = await page.content();
            const $ = cheerio.load(String(html || ''));
            const data: LatestRelease[] = [];
            const seen = new Set<string>();

            $('a[href^="/play/"], a[href*="/play/"]').each((_, element) => {
                const $element = $(element);
                const href = String($element.attr('href') || '').trim();
                const hrefPath = href.replace(/^https?:\/\/[^/]+/i, '');
                const parts = hrefPath.split(/[?#]/)[0].split('/').filter(Boolean);
                const playIndex = parts.findIndex((part) => part.toLowerCase() === 'play');
                const animeSession = playIndex >= 0 ? String(parts[playIndex + 1] || '').trim() : '';
                const episodeSession = playIndex >= 0 ? String(parts[playIndex + 2] || '').trim() : '';
                if (!animeSession || !episodeSession) return;

                const image = $element.find('img').first();
                const snapshot = String(
                    image.attr('data-src') ||
                    image.attr('data-original') ||
                    image.attr('src') ||
                    ''
                ).trim();
                const rawText = String($element.text() || image.attr('alt') || '').replace(/\s+/g, ' ').trim();
                const episodeMatch = rawText.match(/(\d+(?:\.\d+)?)\s*$/);
                const episodeNumber = Number(episodeMatch?.[1] || 0);
                const title = rawText
                    .replace(/(\d+(?:\.\d+)?)\s*$/, '')
                    .replace(/^watch\s+/i, '')
                    .trim() || String(image.attr('alt') || '').trim();

                const key = `${animeSession}:${episodeSession}`;
                if (!title || !Number.isFinite(episodeNumber) || episodeNumber <= 0 || seen.has(key)) return;
                seen.add(key);

                data.push({
                    id: key,
                    title,
                    animeSession,
                    episodeSession,
                    session: animeSession,
                    episodeNumber,
                    snapshot: snapshot ? this.normalizePlayLinkUrl(snapshot) : undefined,
                    url: `/play/${animeSession}/${episodeSession}`,
                });
            });

            let lastPage = pageNum;
            $('[href*="page="], [data-page]').each((_, element) => {
                const href = String($(element).attr('href') || '').trim();
                const dataPage = String($(element).attr('data-page') || '').trim();
                const pageMatch = href.match(/[?&]page=(\d+)/i);
                const pageValue = Number(pageMatch?.[1] || dataPage || 0);
                if (Number.isFinite(pageValue) && pageValue > lastPage) {
                    lastPage = Math.floor(pageValue);
                }
            });

            return {
                data,
                pagination: {
                    current_page: pageNum,
                    last_visible_page: Math.max(1, lastPage),
                    has_next_page: pageNum < lastPage,
                },
            };
        } catch (error) {
            console.error('Error getting AnimePahe latest releases:', error);
            return {
                data: [],
                pagination: {
                    current_page: pageNum,
                    last_visible_page: pageNum,
                    has_next_page: false,
                },
            };
        } finally {
            await page.close();
        }
    }

    private parseAnimeInfoFromHtml(html: string): AnimeInfo | null {
        const sourceHtml = String(html || '');
        const normalizedHtml = sourceHtml.toLowerCase();
        if (
            normalizedHtml.includes('checking your browser before accessing animepahe.com') ||
            normalizedHtml.includes('ddos-guard') ||
            normalizedHtml.includes('why do i have to complete a captcha')
        ) {
            return null;
        }

        const $ = cheerio.load(sourceHtml);
        const rawTitle =
            $('div.title-wrapper h1').first().text().trim() ||
            $('h1').first().text().trim() ||
            $('meta[property="og:title"]').attr('content')?.trim() ||
            $('title').text().replace(/\s*-\s*AnimePahe.*$/i, '').trim();
        const title =
            rawTitle && rawTitle.length % 2 === 0 && rawTitle.slice(0, rawTitle.length / 2) === rawTitle.slice(rawTitle.length / 2)
                ? rawTitle.slice(0, rawTitle.length / 2).trim()
                : rawTitle;

        if (!title) return null;

        const description =
            $('meta[property="og:description"]').attr('content')?.trim() ||
            $('.anime-synopsis').first().text().trim() ||
            $('div.anime-synopsis').first().text().trim() ||
            undefined;

        const poster =
            $('meta[property="og:image"]').attr('content')?.trim() ||
            $('img').filter((_, el) => String($(el).attr('src') || '').includes('/posters/')).first().attr('src')?.trim() ||
            undefined;

        const statsText = $('body').text();
        const episodesMatch = statsText.match(/Episodes:\s*(\d+)/i);
        const yearMatch = statsText.match(/Season:\s*[A-Za-z]+\s+(\d{4})/i) || statsText.match(/Aired:\s*.*?(\d{4})/i);
        const statusMatch = statsText.match(/Status:\s*([A-Za-z ]+)/i);
        const typeMatch = statsText.match(/Type:\s*([A-Za-z]+)/i);

        return {
            title,
            poster,
            description,
            status: statusMatch?.[1]?.trim(),
            type: typeMatch?.[1]?.trim(),
            episodes: episodesMatch?.[1] ? Number(episodesMatch[1]) : null,
            year: yearMatch?.[1] ? Number(yearMatch[1]) : null,
        };
    }

    async getAnimeInfo(session: string): Promise<AnimeInfo | null> {
        const animeUrl = `${BASE_URL}/anime/${session}`;

        try {
            const response = await axios.get(animeUrl, {
                headers: {
                    ...this.requestHeaders,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                },
                timeout: 15000,
                responseType: 'text',
            });

            const html = String(response.data || '');
            const parsed = this.parseAnimeInfoFromHtml(html);
            if (parsed) {
                return parsed;
            }
        } catch (error) {
            // Fall through to browser-backed fetch.
        }

        {
            const browser = await this.getBrowser();
            const page = await browser.newPage();
            await page.setUserAgent(this.requestHeaders['User-Agent']);

            try {
                await page.setRequestInterception(true);
                page.on('request', (req) => {
                    const resourceType = req.resourceType();
                    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await page.goto(animeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await this.waitForChallengeBypass(page);
                const html = await page.content();
                return this.parseAnimeInfoFromHtml(html);
            } catch (fallbackError) {
                console.error('Error getting AnimePahe info:', fallbackError);
                return null;
            } finally {
                await page.close();
            }
        }
    }

    async getEpisodes(animeSessionId: string, pageNum: number = 1): Promise<{ episodes: Episode[], lastPage: number }> {
        if (this.isMirrorSession(animeSessionId)) {
            return this.getMirrorEpisodes(animeSessionId);
        }

        const buildEpisodesApiUrl = (page: number) =>
            `${API_URL}?m=release&id=${animeSessionId}&sort=episode_asc&page=${page}`;
        const animeUrl = `${BASE_URL}/anime/${animeSessionId}`;
        const mapApiEpisodes = (items: any[]): Episode[] => items.map((item: any) => ({
            id: item.id.toString(),
            session: item.session,
            episodeNumber: item.episode,
            url: `/play/${animeSessionId}/${item.session}`,
            title: item.title,
            duration: item.duration,
            snapshot: item.snapshot
        }));
        const dedupeAndSortEpisodes = (items: Episode[]): Episode[] => {
            const bySession = new Map<string, Episode>();
            items.forEach((episode) => {
                const key = String(episode.session || episode.id || episode.episodeNumber);
                if (!key) return;
                bySession.set(key, episode);
            });
            return [...bySession.values()].sort((a, b) => Number(a.episodeNumber) - Number(b.episodeNumber));
        };
        const getMinimumExpectedEpisodes = (lastPage: number) => {
            const normalizedLastPage = Number.isFinite(lastPage) && lastPage > 0 ? Math.floor(lastPage) : 1;
            return normalizedLastPage <= 1 ? 1 : ((normalizedLastPage - 1) * 30) + 1;
        };
        const isCompletePayload = (episodes: Episode[], lastPage: number) =>
            episodes.length >= getMinimumExpectedEpisodes(lastPage);
        const fetchRemainingPages = async <T>(
            startPage: number,
            lastPage: number,
            fetcher: (page: number) => Promise<T | null>
        ) => {
            const results: Array<{ page: number; payload: T | null }> = [];
            for (let chunkStart = startPage; chunkStart <= lastPage; chunkStart += this.EPISODE_FETCH_CONCURRENCY) {
                const chunkPages = Array.from(
                    { length: Math.min(this.EPISODE_FETCH_CONCURRENCY, lastPage - chunkStart + 1) },
                    (_, index) => chunkStart + index
                );
                const chunkResults = await Promise.all(
                    chunkPages.map(async (currentPage) => ({
                        page: currentPage,
                        payload: await fetcher(currentPage)
                    }))
                );
                results.push(...chunkResults);
            }
            return results.sort((a, b) => a.page - b.page);
        };
        const fetchEpisodesViaApi = async () => {
            const first = await this.fetchApiJson(buildEpisodesApiUrl(pageNum));
            if (!first || !Array.isArray(first?.data)) return null;

            const lastPage = Number(first?.last_page || 1);
            const pages = [first];
            const remaining = await fetchRemainingPages(pageNum + 1, lastPage, async (currentPage) =>
                await this.fetchApiJson(buildEpisodesApiUrl(currentPage))
            );
            for (const { payload: next } of remaining) {
                if (!next || !Array.isArray(next?.data)) {
                    return {
                        episodes: dedupeAndSortEpisodes(
                            pages.flatMap((payload: any) => Array.isArray(payload?.data) ? mapApiEpisodes(payload.data) : [])
                        ),
                        lastPage,
                        complete: false,
                    };
                }
                pages.push(next);
            }

            return {
                episodes: dedupeAndSortEpisodes(
                    pages.flatMap((payload: any) => Array.isArray(payload?.data) ? mapApiEpisodes(payload.data) : [])
                ),
                lastPage,
                complete: true,
            };
        };
        const apiResult = await fetchEpisodesViaApi();
        if (apiResult?.episodes.length) {
            if (apiResult.complete && isCompletePayload(apiResult.episodes, apiResult.lastPage)) {
                return { episodes: apiResult.episodes, lastPage: apiResult.lastPage };
            }
            console.warn(`AnimePahe API returned partial episode list for ${animeSessionId}: ${apiResult.episodes.length}/${apiResult.lastPage} pages`);
        }

        // Browser context is the only fallback inside the AnimePahe scraper, used when the direct API is challenge-protected.
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent(this.requestHeaders['User-Agent']);

        try {
            console.log(`Fetching episodes via browser context: ${animeSessionId}`);

            // Optimize: Block heavy resources
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            await page.goto(animeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await this.waitForChallengeBypass(page, 20000);

            const browserApiResponse = await page.evaluate(async (sessionId) => {
                const firstResponse = await fetch(`/api?m=release&id=${encodeURIComponent(sessionId)}&sort=episode_asc&page=1`, {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json, text/plain, */*'
                    }
                });
                const firstText = await firstResponse.text();
                let firstParsed = null;
                try {
                    firstParsed = JSON.parse(firstText);
                } catch {
                    return {
                        ok: false,
                        first: {
                            ok: false,
                            status: firstResponse.status,
                            text: firstText
                        }
                    };
                }

                const first = {
                    ok: firstResponse.ok,
                    status: firstResponse.status,
                    parsed: firstParsed
                };
                if (!first.ok || !first.parsed?.data) {
                    return { ok: false, first };
                }

                const lastPage = Number(first.parsed.last_page || 1);
                const pages = [first.parsed];
                const concurrency = 6;
                for (let chunkStart = 2; chunkStart <= lastPage; chunkStart += concurrency) {
                    const chunkPages = Array.from(
                        { length: Math.min(concurrency, lastPage - chunkStart + 1) },
                        (_, index) => chunkStart + index
                    );
                    const chunkResults = await Promise.all(
                        chunkPages.map(async (currentPage) => {
                            const nextResponse = await fetch(`/api?m=release&id=${encodeURIComponent(sessionId)}&sort=episode_asc&page=${currentPage}`, {
                                credentials: 'include',
                                headers: {
                                    'Accept': 'application/json, text/plain, */*'
                                }
                            });
                            const nextText = await nextResponse.text();
                            let nextParsed = null;
                            try {
                                nextParsed = JSON.parse(nextText);
                            } catch {
                                return {
                                    page: currentPage,
                                    ok: false,
                                    failed: {
                                        ok: false,
                                        status: nextResponse.status,
                                        text: nextText
                                    }
                                };
                            }

                            if (!nextResponse.ok || !nextParsed?.data) {
                                return {
                                    page: currentPage,
                                    ok: false,
                                    failed: {
                                        ok: nextResponse.ok,
                                        status: nextResponse.status,
                                        parsed: nextParsed
                                    }
                                };
                            }

                            return {
                                page: currentPage,
                                ok: true,
                                parsed: nextParsed
                            };
                        })
                    );

                    const failed = chunkResults.find((entry) => !entry.ok);
                    if (failed) {
                        return {
                            ok: false,
                            first,
                            failedPage: failed.page,
                            failed: failed.failed
                        };
                    }

                    chunkResults
                        .sort((a, b) => a.page - b.page)
                        .forEach((entry) => {
                            if (entry.ok && entry.parsed) pages.push(entry.parsed);
                        });
                }

                return { ok: true, pages, lastPage };
            }, animeSessionId);

            if (browserApiResponse?.ok && Array.isArray(browserApiResponse.pages)) {
                const episodes = dedupeAndSortEpisodes(
                    browserApiResponse.pages.flatMap((payload: any) =>
                        Array.isArray(payload?.data) ? mapApiEpisodes(payload.data) : []
                    )
                );

                const lastPage = Number(browserApiResponse.lastPage || 1);
                if (isCompletePayload(episodes, lastPage)) {
                    return {
                        episodes,
                        lastPage
                    };
                }
                console.warn(`AnimePahe browser episode fetch incomplete for ${animeSessionId}: ${episodes.length}/${lastPage} pages`);
            }

            console.warn('Browser API episode fetch failed, falling back to HTML page scrape');
            return await this.getEpisodesFromHtml(page, animeSessionId);
        } catch (error) {
            console.error('Error getting episodes:', error);
            const htmlFallback = await this.getEpisodesFromHtml(null as any, animeSessionId);
            return htmlFallback.episodes.length > 0 ? htmlFallback : { episodes: [], lastPage: 1 };
        } finally {
            await page.close();
        }
    }

    private async getEpisodesFromHtml(_page: Page | null, animeSessionId: string): Promise<{ episodes: Episode[], lastPage: number }> {
        const animeUrl = `${BASE_URL}/anime/${animeSessionId}`;
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent(this.requestHeaders['User-Agent']);
        try {
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            await page.goto(animeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await this.waitForChallengeBypass(page, 15000);
            const extractEpisodesFromHtml = (html: string): Episode[] => {
                const $ = cheerio.load(String(html || ''));
                const episodes: Episode[] = [];

                $('a.play').each((_, element) => {
                    const href = String($(element).attr('href') || '').trim();
                    if (!href.startsWith('/play/')) return;

                    const title = $(element).text().trim().replace(/^Watch\s*-\s*/i, '').replace(/\s+Online$/i, '').trim();
                    const parts = href.split('/').filter(Boolean);
                    const episodeSession = parts[parts.length - 1];
                    const animeSession = parts[parts.length - 2];
                    if (!episodeSession || !animeSession) return;

                    const epMatch = title.match(/(\d+(?:\.\d+)?)/);
                    const episodeNumber = epMatch ? Number(epMatch[1]) : NaN;
                    if (!Number.isFinite(episodeNumber)) return;

                    episodes.push({
                        id: episodeSession,
                        session: episodeSession,
                        episodeNumber,
                        url: href,
                        title: `Episode ${episodeNumber}`,
                    });
                });

                return episodes;
            };
            const dedupeAndSortEpisodes = (items: Episode[]): Episode[] => {
                const bySession = new Map<string, Episode>();
                items.forEach((episode) => {
                    const key = String(episode.session || episode.id || episode.episodeNumber);
                    if (!key) return;
                    bySession.set(key, episode);
                });
                return [...bySession.values()].sort((a, b) => Number(a.episodeNumber) - Number(b.episodeNumber));
            };

            const extractLastPageFromHtml = (html: string): number => {
                const $ = cheerio.load(String(html || ''));
                let lastPage = 1;

                $('[href*="page="], [data-page]').each((_, element) => {
                    const href = String($(element).attr('href') || '').trim();
                    const dataPage = String($(element).attr('data-page') || '').trim();
                    const hrefPageMatch = href.match(/[?&]page=(\d+)/i);
                    const value = Number(hrefPageMatch?.[1] || dataPage || 0);
                    if (Number.isFinite(value) && value > lastPage) {
                        lastPage = Math.floor(value);
                    }
                });

                return lastPage;
            };

            const html = await page.content();
            const lastPage = extractLastPageFromHtml(html);
            const pagesHtml: string[] = [html];

            if (lastPage > 1) {
                const remainingPages = await page.evaluate(
                    async ({ sessionId, totalPages }) => {
                        const responses: Array<{ page: number; html: string | null }> = [];
                        const concurrency = 4;

                        for (let chunkStart = 2; chunkStart <= totalPages; chunkStart += concurrency) {
                            const chunkPages = Array.from(
                                { length: Math.min(concurrency, totalPages - chunkStart + 1) },
                                (_, index) => chunkStart + index
                            );

                            const chunkResults = await Promise.all(
                                chunkPages.map(async (currentPage) => {
                                    try {
                                        const response = await fetch(
                                            `/anime/${encodeURIComponent(sessionId)}?page=${currentPage}`,
                                            {
                                                credentials: 'include',
                                                headers: {
                                                    'Accept': 'text/html,application/xhtml+xml'
                                                }
                                            }
                                        );
                                        const nextHtml = await response.text();
                                        return { page: currentPage, html: nextHtml };
                                    } catch {
                                        return { page: currentPage, html: null };
                                    }
                                })
                            );

                            responses.push(...chunkResults);
                        }

                        return responses.sort((a, b) => a.page - b.page);
                    },
                    { sessionId: animeSessionId, totalPages: lastPage }
                );

                for (const result of remainingPages) {
                    if (typeof result?.html === 'string' && result.html.trim()) {
                        pagesHtml.push(result.html);
                    }
                }
            }

            const episodes = dedupeAndSortEpisodes(
                pagesHtml.flatMap((pageHtml) => extractEpisodesFromHtml(pageHtml))
            );
            return { episodes, lastPage };
        } catch (error) {
            console.error('Error getting AnimePahe episodes from HTML:', error);
            return { episodes: [], lastPage: 1 };
        } finally {
            await page.close();
        }
    }

    private normalizePlayLinkUrl(url: string): string {
        const raw = String(url || '').trim();
        if (!raw) return '';
        if (raw.startsWith('//')) return `https:${raw}`;
        if (raw.startsWith('/')) return `${BASE_URL}${raw}`;
        return raw;
    }

    private extractPlayPageLinks(html: string): Array<{ kwik: string; quality: string; audio: string }> {
        const $ = cheerio.load(String(html || ''));
        const links: Array<{ kwik: string; quality: string; audio: string }> = [];

        $('#resolutionMenu button, #resolutionMenu a, button[data-src][data-resolution], a[data-src][data-resolution]').each((_, element) => {
            const $element = $(element);
            const kwik = String($element.attr('data-src') || $element.attr('href') || '').trim();
            if (!kwik) return;

            links.push({
                kwik,
                quality: String($element.attr('data-resolution') || $element.text() || '').trim(),
                audio: String($element.attr('data-audio') || '').trim(),
            });
        });

        return links;
    }

    private mapPlayPageLinks(links: Array<{ kwik: string; quality: string; audio: string }>): StreamLink[] {
        const seen = new Set<string>();

        return links.flatMap((link) => {
            const kwikUrl = this.normalizePlayLinkUrl(link.kwik);
            if (!kwikUrl) return [];

            const quality =
                String(link.quality || '')
                    .replace(/[^\d]/g, '')
                    .trim() || '720';
            const audio = String(link.audio || 'sub').trim() || 'sub';
            const dedupeKey = `${kwikUrl}::${quality}::${audio.toLowerCase()}`;
            if (seen.has(dedupeKey)) return [];
            seen.add(dedupeKey);

            return [{
                quality,
                audio,
                provider: 'animepahe',
                server: 'kwik',
                url: kwikUrl,
                isHls: false
            }];
        });
    }

    private async getMirrorEpisodes(animeSessionId: string): Promise<{ episodes: Episode[], lastPage: number }> {
        const slug = this.toMirrorSlug(animeSessionId);
        if (!slug) return { episodes: [], lastPage: 1 };

        try {
            const firstEpisodeUrl = this.mirrorEpisodePageUrl(slug, 1);
            const response = await axios.get(firstEpisodeUrl, {
                headers: {
                    ...this.requestHeaders,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    Referer: MIRROR_BASE_URL,
                },
                timeout: 12000,
                responseType: 'text',
            });

            const $ = cheerio.load(String(response.data || ''));
            const episodesByNumber = new Map<number, Episode>();
            const addEpisode = (episodeNumber: number, href?: string, title?: string) => {
                if (!Number.isFinite(episodeNumber) || episodeNumber <= 0) return;
                const episodeSlug = `${slug}-episode-${episodeNumber}-english-subbed`;
                episodesByNumber.set(episodeNumber, {
                    id: episodeSlug,
                    session: `${MIRROR_SESSION_PREFIX}${episodeSlug}`,
                    episodeNumber,
                    url: href || this.mirrorEpisodePageUrl(slug, episodeNumber),
                    title: title || `Episode ${episodeNumber}`,
                });
            };

            addEpisode(1, firstEpisodeUrl);
            $('a[href]').each((_, element) => {
                const href = String($(element).attr('href') || '').trim();
                const match = href.match(new RegExp(`${slug}-episode-(\\d+(?:\\.\\d+)?)-english-subbed`, 'i'));
                if (!match) return;
                addEpisode(Number(match[1]), href, $(element).attr('title') || $(element).text().trim());
            });

            const episodes = [...episodesByNumber.values()]
                .sort((a, b) => Number(a.episodeNumber) - Number(b.episodeNumber));

            return { episodes, lastPage: 1 };
        } catch {
            return { episodes: [], lastPage: 1 };
        }
    }

    async getLinks(animeSession: string, episodeSession: string): Promise<StreamLink[]> {
        if (this.isMirrorSession(animeSession) || this.isMirrorSession(episodeSession)) {
            return this.getMirrorLinks(animeSession, episodeSession);
        }

        const fullUrl = `${BASE_URL}/play/${animeSession}/${episodeSession}`;

        try {
            const htmlResponse = await axios.get(fullUrl, {
                headers: {
                    ...this.requestHeaders,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                timeout: 15000,
                responseType: 'text',
            });

            const fastLinks = this.mapPlayPageLinks(this.extractPlayPageLinks(String(htmlResponse.data || '')));
            if (fastLinks.length > 0) {
                return fastLinks;
            }
        } catch {
            // Fall through to browser-backed page resolution.
        }

        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent(this.requestHeaders['User-Agent']);

        const extractLinksFromPage = async (): Promise<Array<{ kwik: string; quality: string; audio: string }>> => {
            const liveLinks = await page.evaluate(() => {
                const elements = Array.from(
                    document.querySelectorAll('#resolutionMenu button, #resolutionMenu a, button[data-src][data-resolution], a[data-src][data-resolution]')
                );

                return elements
                    .map((element) => ({
                        kwik: element.getAttribute('data-src') || element.getAttribute('href') || '',
                        quality: element.getAttribute('data-resolution') || element.textContent || '',
                        audio: element.getAttribute('data-audio') || '',
                    }))
                    .filter((entry) => Boolean(entry.kwik));
            });

            if (liveLinks.length > 0) {
                return liveLinks;
            }

            return this.extractPlayPageLinks(await page.content());
        };

        try {
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            for (let navigationAttempt = 0; navigationAttempt < 2; navigationAttempt += 1) {
                if (navigationAttempt === 0) {
                    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                } else {
                    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                }

                await this.waitForChallengeBypass(page, 70000);

                for (let readAttempt = 0; readAttempt < 4; readAttempt += 1) {
                    const links = this.mapPlayPageLinks(await extractLinksFromPage());
                    if (links.length > 0) {
                        return links;
                    }

                    if (readAttempt === 0) {
                        try {
                            await page.waitForSelector('#resolutionMenu button[data-src], #resolutionMenu a[data-src]', { timeout: 5000 });
                            const waitedLinks = this.mapPlayPageLinks(await extractLinksFromPage());
                            if (waitedLinks.length > 0) {
                                return waitedLinks;
                            }
                        } catch {
                            // Keep polling below.
                        }
                    }

                    await new Promise((resolve) => setTimeout(resolve, 1500 * (readAttempt + 1)));
                }
            }

            console.warn(`AnimePahe play page yielded no stream links for ${animeSession}/${episodeSession}`);
            return [];
        } catch (error) {
            console.error('Error getting AnimePahe links:', error);
            return [];
        } finally {
            await page.close();
        }
    }

    private async getMirrorLinks(animeSession: string, episodeSession: string): Promise<StreamLink[]> {
        const animeSlug = this.toMirrorSlug(animeSession);
        const episodeSlug = this.toMirrorSlug(episodeSession);
        const episodeMatch = episodeSlug.match(/-episode-(\d+(?:\.\d+)?)-english-subbed$/i);
        const episodeNumber = Number(episodeMatch?.[1] || 1);
        const baseSlug = episodeMatch ? episodeSlug.replace(/-episode-\d+(?:\.\d+)?-english-subbed$/i, '') : animeSlug;
        if (!baseSlug) return [];

        try {
            const response = await axios.get(this.mirrorEpisodePageUrl(baseSlug, episodeNumber), {
                headers: {
                    ...this.requestHeaders,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    Referer: MIRROR_BASE_URL,
                },
                timeout: 12000,
                responseType: 'text',
            });

            const embedUrl = this.extractMirrorEmbedUrl(String(response.data || ''));
            if (!embedUrl) return [];

            return [{
                quality: '720',
                audio: 'sub',
                provider: 'animepahe',
                server: 'mirror-embed',
                url: embedUrl,
                isHls: false,
            }];
        } catch {
            return [];
        }
    }

    async resolveStreamUrl(stream: StreamLink): Promise<string> {
        const directUrl = String(stream.directUrl || '').trim();
        if (directUrl) return directUrl;

        const url = String(stream.url || '').trim();
        if (!url) return '';

        if (/^https?:\/\/([^/]+\.)?kwik\./i.test(url)) {
            return await this.resolveKwik(url) || url;
        }

        return url;
    }

    private decodePackedString(value: string): string {
        return Function(`"use strict"; return '${value}';`)();
    }

    private unpackJsPacker(script: string): string | null {
        const match = script.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:\\'|[^'])*)',(\d+),(\d+),'((?:\\'|[^'])*)'\.split\('\|'\),0,\{\}\)\)/);
        if (!match) return null;

        let payload = this.decodePackedString(match[1]);
        const radix = Number(match[2]);
        let count = Number(match[3]);
        const symbols = this.decodePackedString(match[4]).split('|');

        const encode = (value: number): string => (
            value < radix ? '' : encode(Math.floor(value / radix))
        ) + ((value = value % radix) > 35 ? String.fromCharCode(value + 29) : value.toString(36));

        while (count--) {
            const key = encode(count);
            const replacement = symbols[count] || key;
            if (replacement) {
                payload = payload.replace(new RegExp(`\\b${key}\\b`, 'g'), replacement);
            }
        }

        return payload;
    }

    private extractM3u8FromKwikHtml(html: string): string | null {
        const directMatch = html.match(/https?:\/\/[^'"\s<>]+\.m3u8[^'"\s<>]*/i);
        if (directMatch?.[0]) return directMatch[0];

        const packedScripts = html.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('(?:\\'|[^'])*',\d+,\d+,'(?:\\'|[^'])*'\.split\('\|'\),0,\{\}\)\)/g) || [];
        for (const script of packedScripts) {
            const unpacked = this.unpackJsPacker(script);
            if (!unpacked) continue;

            const urlMatch =
                unpacked.match(/\bsource\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i) ||
                unpacked.match(/https?:\/\/[^'"\s<>]+\.m3u8[^'"\s<>]*/i);
            const resolvedUrl = urlMatch?.[1] || urlMatch?.[0];
            if (resolvedUrl) return resolvedUrl;
        }

        return null;
    }

    private async resolveKwikFast(url: string): Promise<string | null> {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.requestHeaders['User-Agent'],
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    Referer: 'https://animepahe.pw/',
                    Origin: 'https://animepahe.pw',
                },
                responseType: 'text',
                timeout: 15000,
            });

            return this.extractM3u8FromKwikHtml(String(response.data || ''));
        } catch {
            return null;
        }
    }

    private async resolveKwik(url: string): Promise<string | null> {
        const fast = await this.resolveKwikFast(url);
        if (fast) return fast;

        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'referer': 'https://animepahe.pw/',
            'origin': 'https://animepahe.pw'
        });

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            // The direct link is usually inside a packed script.
            // We can wait for the page to evaluate it or extract and solve.
            // Let's try to find potential source from content first.
            const content = await page.content();

            // Logic to handle kwik's eval(p,a,c,k,e,d)
            // Or just wait for the video tag to appear?
            // Usually kwik loads a script that then creates the video/source.

            const directUrl = await page.evaluate(() => {
                // Try to find the script and execute a modified version to get the URL?
                // Actually, kwik's script usually sets a variable or just creates the player.
                // Let's try to extract it from the source code directly using regex if it's there.
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const script of scripts) {
                    const text = script.textContent || '';
                    if (text.includes('eval(function(p,a,c,k,e,d)')) {
                        // This is the one. We could try to decode it, 
                        // but maybe it's already in a variable after execution?
                        // Let's check common variables.
                    }
                }

                // Often kwik has a "source" variable or similar in the window
                return (window as any).source || (document.querySelector('source') as any)?.src || null;
            });

            if (directUrl) return directUrl;

            // If not found, use regex on the content
            const packedMatches = content.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('[\s\S]*?\.split\('\|'\),0,\{\}\)\)/g) || [];
            for (const packed of packedMatches) {
                const solved = await page.evaluate((packedScript) => {
                    try {
                        let result = '';
                        const originalEval = window.eval;
                        (window as any).eval = (s: string) => { result = s; return originalEval(s); };
                        originalEval(packedScript);
                        (window as any).eval = originalEval;
                        return result;
                    } catch (e) {
                        return null;
                    }
                }, packed);

                if (solved) {
                    const urlMatch =
                        solved.match(/\bsource\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i) ||
                        solved.match(/(https?:\/\/[^'"\s]+\.m3u8[^'"\s]*)/i);
                    const resolvedUrl = urlMatch?.[1] || urlMatch?.[0];
                    if (resolvedUrl) return resolvedUrl;
                }
            }

            return null;
        } catch (e) {
            return null;
        } finally {
            await page.close();
        }
    }
}
