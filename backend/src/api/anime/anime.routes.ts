import { Router } from 'express';
import { animeQuery, streambertAnimeService } from './anime.service';
import { animeVideoSources } from './video-sources';

const router = Router();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

router.use((req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const entry = rateLimitMap.get(key);

    if (!entry || entry.resetAt <= now) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        next();
        return;
    }

    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX) {
        res.status(429).json({ error: 'Rate limit exceeded' });
        return;
    }

    next();
});

router.get('/metadata', async (req, res) => {
    try {
        const anilistId = Number(req.query.anilistId || req.query.id);
        if (!Number.isFinite(anilistId) || anilistId <= 0) {
            res.status(400).json({ error: 'Query parameter anilistId is required' });
            return;
        }

        const metadata = await streambertAnimeService.getMetadata(Math.floor(anilistId));
        if (!metadata) {
            res.status(404).json({ error: 'Anime not found' });
            return;
        }

        res.set('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400');
        res.json(metadata);
    } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to fetch anime metadata' });
    }
});

router.get('/search', async (req, res) => {
    try {
        const filters = streambertAnimeService.parseSearchFilters(req.query);
        if (!filters.query && !filters.season && !filters.seasonYear && !filters.status && !filters.format && !filters.genres?.length && !filters.tags?.length) {
            res.status(400).json({ error: 'Query parameter query is required unless filters are provided' });
            return;
        }

        const result = await streambertAnimeService.search(filters);
        res.set('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=600');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to search anime' });
    }
});

router.get('/episodes', async (req, res) => {
    try {
        const anilistId = Number(req.query.anilistId || req.query.id);
        if (!Number.isFinite(anilistId) || anilistId <= 0) {
            res.status(400).json({ error: 'Query parameter anilistId is required' });
            return;
        }

        const result = await streambertAnimeService.getEpisodes(Math.floor(anilistId));
        if (!result) {
            res.status(404).json({ error: 'Anime not found' });
            return;
        }

        res.set('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to fetch anime episodes' });
    }
});

router.get('/episode/:episodeId', async (req, res) => {
    try {
        const anilistId = Number(req.query.anilistId || req.query.id);
        if (!Number.isFinite(anilistId) || anilistId <= 0) {
            res.status(400).json({ error: 'Query parameter anilistId is required' });
            return;
        }

        const result = await streambertAnimeService.getEpisode(Math.floor(anilistId), req.params.episodeId);
        if (!result) {
            res.status(404).json({ error: 'Episode not found' });
            return;
        }

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to fetch anime episode' });
    }
});

router.get('/stream', async (req, res) => {
    try {
        const anilistId = Number(req.query.anilistId || req.query.id);
        const episode = Number(req.query.episode || 1);
        const source = String(req.query.source || 'videasy');
        if (!Number.isFinite(anilistId) || anilistId <= 0) {
            res.status(400).json({ error: 'Query parameter anilistId is required' });
            return;
        }
        if (!Number.isFinite(episode) || episode <= 0) {
            res.status(400).json({ error: 'Query parameter episode must be a positive number' });
            return;
        }

        const result = await animeVideoSources.getStream(Math.floor(anilistId), episode, source);
        if (!result) {
            res.status(404).json({ error: 'No playable stream found' });
            return;
        }

        res.set('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=3600');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to resolve anime stream' });
    }
});

router.get('/trending', async (req, res) => {
    const page = animeQuery.toPositiveInt(req.query.page, 1, 500);
    const perPage = animeQuery.toPositiveInt(req.query.perPage || req.query.limit, 10, 50);
    const result = await streambertAnimeService.trending(page, perPage);
    res.json(result);
});

router.get('/popular', async (req, res) => {
    const page = animeQuery.toPositiveInt(req.query.page, 1, 500);
    const perPage = animeQuery.toPositiveInt(req.query.perPage || req.query.limit, 10, 50);
    const result = await streambertAnimeService.popular(page, perPage);
    res.json(result);
});

router.get('/seasonal', async (req, res) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const defaultSeason = month <= 3 ? 'WINTER' : month <= 6 ? 'SPRING' : month <= 9 ? 'SUMMER' : 'FALL';
    const season = String(req.query.season || defaultSeason).toUpperCase();
    const year = animeQuery.toPositiveInt(req.query.year || req.query.seasonYear, now.getFullYear(), 3000);
    const page = animeQuery.toPositiveInt(req.query.page, 1, 500);
    const perPage = animeQuery.toPositiveInt(req.query.perPage || req.query.limit, 10, 50);
    const result = await streambertAnimeService.seasonal(season, year, page, perPage);
    res.json(result);
});

export default router;
