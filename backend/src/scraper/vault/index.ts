import { Router } from 'express';
import { scrapeToonilyHome, scrapeToonilyDetails, scrapeToonilyPages, scrapeToonilySearch } from './vaultmanhwa';
import { scrapeHanimeHome, scrapeHanimeVideo, scrapeHanimeSearch } from './vaultanime';
import { readPersistedVaultHome, writePersistedVaultHome } from './persistent-cache';

const router = Router();

const getErrorMessage = (error: unknown) => (
    error instanceof Error ? error.message : String(error)
);

router.get('/manga/home', async (req, res) => {
    try {
        const homeData = await scrapeToonilyHome();
        writePersistedVaultHome('manga', homeData);
        res.json({ success: true, data: homeData });
    } catch (error: unknown) {
        console.error('[Vault API] Error fetching Toonily home:', getErrorMessage(error));
        const cached = readPersistedVaultHome('manga');
        if (cached) {
            return res.json({
                success: true,
                data: cached.data,
                stale: true,
                cachedAt: cached.updatedAt,
                message: 'Using saved Vault manga data while the live source is unavailable',
            });
        }
        res.status(500).json({ success: false, message: 'Failed to fetch Vault manga data' });
    }
});

router.get('/manga/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        if (!query) return res.json({ success: true, data: [] });
        const results = await scrapeToonilySearch(query);
        res.json({ success: true, data: results });
    } catch (error: unknown) {
        console.error('[Vault API] Error searching Toonily:', getErrorMessage(error));
        res.status(500).json({ success: false, message: 'Failed to search Vault manga' });
    }
});

const detailsCache = new Map<string, {data: unknown, timestamp: number}>();
const CACHE_TTL = 3600 * 1000; // 1 hour

router.get('/manga/details/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const now = Date.now();
        if (detailsCache.has(id)) {
            const cached = detailsCache.get(id)!;
            if (now - cached.timestamp < CACHE_TTL) {
                return res.json({ success: true, data: cached.data });
            }
        }

        const detailsData = await scrapeToonilyDetails(id, req.query.url as string);
        detailsCache.set(id, { data: detailsData, timestamp: now });
        res.json({ success: true, data: detailsData });
    } catch {
        res.status(500).json({ success: false });
    }
});

router.get('/manga/pages', async (req, res) => {
    try {
        const pages = await scrapeToonilyPages(req.query.url as string);
        res.json({ success: true, pages });
    } catch {
        res.status(500).json({ success: false });
    }
});

router.get('/anime/home', async (req, res) => {
    console.log('[Vault] Hit /anime/home');
    try {
        const data = await scrapeHanimeHome();
        writePersistedVaultHome('anime', data);
        res.json({ success: true, data });
    } catch (error: unknown) {
        console.error('[Vault API] Error fetching Hanime home:', getErrorMessage(error));
        const cached = readPersistedVaultHome('anime');
        if (cached) {
            return res.json({
                success: true,
                data: cached.data,
                stale: true,
                cachedAt: cached.updatedAt,
                message: 'Using saved Vault anime data while the live source is unavailable',
            });
        }
        res.status(500).json({ success: false, message: 'Failed to fetch Vault anime data' });
    }
});

router.get('/anime/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        if (!query) return res.json({ success: true, data: [] });
        const results = await scrapeHanimeSearch(query);
        res.json({ success: true, data: results });
    } catch (error: unknown) {
        console.error('[Vault API] Error searching Hanime:', getErrorMessage(error));
        res.status(500).json({ success: false, message: 'Failed to search Vault anime' });
    }
});

router.get('/anime/details/:slug', async (req, res) => {
    try {
        const data = await scrapeHanimeVideo(req.params.slug);
        res.json({ success: true, data });
    } catch (error: unknown) {
        console.error('[Vault API] Error fetching Hanime video:', getErrorMessage(error));
        res.status(500).json({ success: false });
    }
});

export default router;
