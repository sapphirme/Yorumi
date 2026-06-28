import puppeteer from './stealth-browser';

let homeCache: any = null;
let homeCacheTime = 0;
const CACHE_TTL = 15 * 60 * 1000;

export const scrapeHanimeHome = async () => {
    if (homeCache && Date.now() - homeCacheTime < CACHE_TTL) {
        return homeCache;
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--no-proxy-server']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.goto('https://hanime.tv', { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        await page.waitForFunction('window.__NUXT__ !== undefined', { timeout: 15000 });
        const state: any = await page.evaluate(() => (window as any).__NUXT__);
        
        const landing = state?.state?.data?.landing;
        if (!landing) throw new Error('Missing landing data from NUXT state');

        const videoMap = new Map<number, any>(landing.hentai_videos.map((v: any) => [v.id, v]));

        // Fetch search API for "recent uploads" to get full metadata (brand, description)
        let recentUploads: any[] = [];
        try {
            const searchRes = await fetch('https://search.htv-services.com/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': HANIME_UA
                },
                body: JSON.stringify({
                    search_text: '',
                    tags: [], tags_mode: 'AND', brands: [], blacklist: [],
                    order_by: 'created_at_unix', ordering: 'desc', page: 0
                })
            });
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                recentUploads = JSON.parse(searchData.hits || '[]');
            }
        } catch (e) {
            console.error('[Vault] Failed to fetch recent uploads from search API', e);
        }

        const recentUploadsMap = new Map();
        for (const hit of recentUploads) {
            recentUploadsMap.set(hit.id, hit);
        }

        const sections = landing.sections.map((sec: any) => {
            return {
                title: sec.title,
                videos: sec.hentai_video_ids.map((id: number) => {
                    const searchHit = recentUploadsMap.get(id);
                    const v = searchHit || videoMap.get(id);
                    if (!v) return null;
                    return {
                        id: v.id,
                        slug: v.slug,
                        title: v.name,
                        image: v.cover_url,
                        poster: v.poster_url || (v.cover_url ? v.cover_url.replace('-cv', '-pv') : ''),
                        views: v.views,
                        description: v.description,
                        brand: v.brand,
                        year: v.released_at_unix ? new Date(v.released_at_unix * 1000).getFullYear() : undefined,
                        tags: v.tags,
                        scraperId: `vault-anime:hanime:${v.slug}`,
                        type: 'Anime'
                    };
                }).filter(Boolean)
            };
        });

        homeCache = sections;
        homeCacheTime = Date.now();
        return sections;
    } catch (e: any) {
        console.error('[Vault] Failed to scrape Hanime home', e);
        throw e;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
};

import { createHash } from 'crypto';

const HANIME_CDN_BASE = 'https://cached.freeanimehentai.net';
const HANIME_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

function generateHanimeSignature(): { signature: string; timestamp: string } {
    const ts = Math.floor(Date.now() / 1000);
    const input = `${ts},Xkdi29,https://hanime.tv,mn2,${ts}`;
    const signature = createHash('sha256').update(input).digest('hex');
    return { signature, timestamp: String(ts) };
}

export const scrapeHanimeVideo = async (slug: string) => {
    // Step 1: Get video metadata and hv_id from the main API
    try {
        const metaRes = await fetch(`https://hanime.tv/api/v8/video?id=${encodeURIComponent(slug)}`, {
            headers: {
                'X-Signature-Version': 'web2',
                'X-Signature': '0',
                'User-Agent': HANIME_UA,
            }
        });

        if (!metaRes.ok) throw new Error(`API returned ${metaRes.status}`);
        const metaData = await metaRes.json();

        const videoData = metaData?.hentai_video;
        if (!videoData) throw new Error('Missing video data from API');

        // Extract the hentai video ID (needed for manifest endpoint)
        const hvId = videoData.id
            || metaData?.videos_manifest?.servers?.[0]?.streams?.[0]?.hv_id;

        if (!hvId) throw new Error('Could not determine hv_id');

        // Step 2: Get real stream URLs from manifest endpoint (Aniyomi approach)
        const { signature, timestamp } = generateHanimeSignature();

        const manifestRes = await fetch(`${HANIME_CDN_BASE}/api/v8/guest/videos/${hvId}/manifest`, {
            headers: {
                'User-Agent': HANIME_UA,
                'Accept': 'application/json',
                'Origin': 'https://hanime.tv',
                'Referer': 'https://hanime.tv/',
                'x-signature': signature,
                'x-time': timestamp,
                'x-signature-version': 'web2',
                'x-session-token': '',
                'x-user-license': '',
                'x-csrf-token': '',
                'x-license': '',
            }
        });

        if (!manifestRes.ok) throw new Error(`Manifest API returned ${manifestRes.status}`);
        const manifestData = await manifestRes.json();
    const servers = manifestData?.videos_manifest?.servers || [];
    const allStreams: any[] = [];

    for (const server of servers) {
        for (const stream of (server.streams || [])) {
            if (!stream.url || !stream.url.includes('.m3u8')) continue;
            if (!stream.is_guest_allowed) continue;

            allStreams.push({
                resolution: String(stream.height),
                url: stream.url,
                kind: 'hls',
                extension: 'm3u8',
                size: stream.filesize_mbs,
            });
        }
    }

    // Sort by resolution descending
    allStreams.sort((a, b) => parseInt(b.resolution) - parseInt(a.resolution));

    console.log(`[Vault] Hanime: Found ${allStreams.length} streams for "${videoData.name}"`);

        return {
            id: videoData.id,
            slug: videoData.slug,
            title: videoData.name,
            description: videoData.description,
            image: videoData.cover_url,
            poster: videoData.poster_url,
            views: videoData.views,
            streams: allStreams,
            tags: videoData.hentai_tags?.map((t: any) => t.text) || [],
            brand: videoData.brand,
            releaseDate: videoData.released_at,
        };
    } catch (e: any) {
        console.error('[Vault API] Error fetching Hanime video:', e.message);
        throw e;
    }
};

export const scrapeHanimeSearch = async (query: string) => {
    try {
        const payload = {
            search_text: query,
            tags: [],
            tags_mode: 'AND',
            brands: [],
            blacklist: [],
            order_by: 'created_at_unix',
            ordering: 'desc',
            page: 0
        };

        const res = await fetch('https://search.htv-services.com/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': HANIME_UA
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`Search API returned ${res.status}`);
        const resData = await res.json();

        const hits = JSON.parse(resData.hits || '[]');
        return hits.map((hit: any) => ({
            id: hit.id,
            slug: hit.slug,
            title: hit.name,
            image: hit.cover_url,
            views: hit.views,
            releaseDate: new Date(hit.released_at * 1000).toISOString(),
            isCensored: hit.is_censored,
            scraperId: `vault-anime:hanime:${hit.slug}`,
            type: 'OVA'
        }));
    } catch (e: any) {
        console.error('[Vault API] Hanime search failed', e.message);
        return [];
    }
};
