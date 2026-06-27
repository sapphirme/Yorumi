import { Router } from 'express';
import { getAnimeLogo, batchGetAnimeLogos } from './fanart.service';

const router = Router();

/**
 * GET /api/logo/:tmdbId
 * Fetch anime logo by TMDB ID
 */
router.get('/:tmdbId', async (req, res) => {
    try {
        const tmdbId = parseInt(req.params.tmdbId);

        if (isNaN(tmdbId)) {
            return res.status(400).json({
                error: 'Invalid TMDB ID',
                logo: null,
                source: 'fallback'
            });
        }

        const result = await getAnimeLogo(tmdbId);

        res.json(result);
    } catch (error) {
        console.error('[Logo API] Error:', error);
        res.status(500).json({
            error: 'Failed to fetch logo',
            logo: null,
            source: 'fallback',
            cached: false
        });
    }
});

/**
 * POST /api/logo/batch
 * Fetch multiple anime logos in one request
 * Body: { tmdbIds: number[] }
 */
router.post('/batch', async (req, res) => {
    try {
        const { tmdbIds } = req.body;

        if (!Array.isArray(tmdbIds) || tmdbIds.length === 0) {
            return res.status(400).json({
                error: 'Invalid request: tmdbIds must be a non-empty array'
            });
        }

        // Limit to 20 IDs per request to prevent abuse
        const ids = tmdbIds.slice(0, 20).map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));

        const results = await batchGetAnimeLogos(ids);

        // Convert Map to object for JSON response
        const response: Record<number, { logo: string | null; source: 'fanart' | 'fallback'; cached: boolean }> = {};
        results.forEach((value, key) => {
            response[key] = value;
        });

        res.json(response);
    } catch (error) {
        console.error('[Logo API] Batch error:', error);
        res.status(500).json({
            error: 'Failed to fetch logos'
        });
    }
});

export default router;
