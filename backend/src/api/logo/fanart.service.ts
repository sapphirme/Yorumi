import axios from 'axios';

const FANART_API_KEY = process.env.FANART_API_KEY || '';
const FANART_BASE_URL = 'https://webservice.fanart.tv/v3/tv';

// Fanart.tv logos are attached at the TV series level, not the season level.
// Fanart.tv logos are attached at the TV series level, not the season level.
// For sequel-heavy shows that share one TVDB series ID across multiple TMDB
// entries, we keep a narrow manual override table keyed by TMDB ID so a
// specific season can use the intended clear logo.
const TMDB_LOGO_OVERRIDES: Record<number, string> = {
    // Classroom of the Elite
    71702: 'https://assets.fanart.tv/fanart/classroom-of-the-elite-65b0e2dc96aa1.png',
};

// Log API key status at startup (don't log the actual key for security)
console.log('[Fanart Service] API Key configured:', FANART_API_KEY ? '✓ Yes' : '✗ No');

// Cache for TVDB ID mappings (TMDB ID -> TVDB ID)
const tvdbMappingCache = new Map<number, string | null>();

// Cache for logo URLs (TVDB ID -> Logo URL)
const logoCache = new Map<string, string | null>();

// Cache for the entire anime list database (loaded once, reused)
let animeDatabaseCache: any[] | null = null;
let databaseLastFetched: number = 0;
let databaseFetchPromise: Promise<any[]> | null = null;
const DATABASE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface FanartTVResponse {
    name: string;
    thetvdb_id: string;
    hdtvlogo?: Array<{
        id: string;
        url: string;
        lang: string;
        likes: string;
    }>;
    clearlogo?: Array<{
        id: string;
        url: string;
        lang: string;
        likes: string;
    }>;
}

interface AnifyMappingResponse {
    id: string;
    mappings: {
        id: string;
        providerId: string;
        similarity: number;
    }[];
}

function getOverrideLogo(tmdbId: number): string | null {
    const override = TMDB_LOGO_OVERRIDES[tmdbId];
    return typeof override === 'string' && override.trim() ? override.trim() : null;
}

/**
 * Resolve TMDB ID to TVDB ID using Fribb/anime-lists static database
 * More reliable than live APIs that frequently timeout
 */
export async function getTVDBIdFromTMDB(tmdbId: number): Promise<string | null> {
    // Check cache first
    if (tvdbMappingCache.has(tmdbId)) {
        const cached = tvdbMappingCache.get(tmdbId);
        console.log(`[Fanart] Cache hit for TMDB ID ${tmdbId} -> TVDB ${cached}`);
        return cached ?? null;
    }

    try {
        // Use cached database if available and not expired
        let animeDatabase = animeDatabaseCache;
        const now = Date.now();

        if (!animeDatabase || (now - databaseLastFetched) > DATABASE_CACHE_TTL) {
            if (!databaseFetchPromise) {
                console.log('[Fanart] Fetching anime database from GitHub...');
                databaseFetchPromise = axios.get(
                    'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json',
                    { timeout: 15000 }
                ).then(response => {
                    if (response.data && Array.isArray(response.data)) {
                        animeDatabaseCache = response.data;
                        databaseLastFetched = Date.now();
                        console.log(`[Fanart] Loaded anime database with ${animeDatabaseCache.length} entries`);
                        return animeDatabaseCache;
                    } else {
                        throw new Error('Invalid database format received');
                    }
                }).finally(() => {
                    databaseFetchPromise = null;
                });
            }

            try {
                animeDatabase = await databaseFetchPromise;
            } catch (err) {
                console.warn('[Fanart] Failed to load database:', err);
                tvdbMappingCache.set(tmdbId, null);
                return null;
            }
        }

        // Find entry matching our TMDB ID
        const entry = animeDatabase.find((item: any) =>
            item.themoviedb_id?.tv === tmdbId || item.themoviedb_id?.movie === tmdbId
        );

        if (entry && entry.tvdb_id) {
            const tvdbIdValue = String(entry.tvdb_id);
            console.log(`[Fanart] Resolved TMDB ${tmdbId} -> TVDB ${tvdbIdValue}`);
            tvdbMappingCache.set(tmdbId, tvdbIdValue);
            return tvdbIdValue;
        }

        console.log(`[Fanart] No TVDB mapping found for TMDB ID ${tmdbId}`);
        tvdbMappingCache.set(tmdbId, null);
        return null;
    } catch (error) {
        console.warn(`[Fanart] Error resolving TVDB ID for TMDB ${tmdbId}:`, error);
        tvdbMappingCache.set(tmdbId, null);
        return null;
    }
}

/**
 * Fetch logo from Fanart.tv using TVDB ID
 */
export async function getFanartLogo(tvdbId: string): Promise<string | null> {
    // Check cache first
    if (logoCache.has(tvdbId)) {
        const cached = logoCache.get(tvdbId);
        console.log(`[Fanart] Logo cache hit for TVDB ${tvdbId}: ${cached}`);
        return cached ?? null;
    }

    if (!FANART_API_KEY) {
        console.warn('[Fanart] API key not configured');
        logoCache.set(tvdbId, null);
        return null;
    }

    try {
        const response = await axios.get<FanartTVResponse>(
            `${FANART_BASE_URL}/${tvdbId}`,
            {
                params: { api_key: FANART_API_KEY },
                timeout: 8000 // Increased to 8 seconds
            }
        );

        if (response.data) {
            // Prioritize HD TV Logo, fallback to Clear Logo
            const hdtvLogo = response.data.hdtvlogo?.find((logo) => logo.lang === 'en');
            const clearLogo = response.data.clearlogo?.find((logo) => logo.lang === 'en');

            // If no English, take first available
            const selectedLogo = hdtvLogo || response.data.hdtvlogo?.[0] ||
                clearLogo || response.data.clearlogo?.[0];

            if (selectedLogo) {
                console.log(`[Fanart] Found logo for TVDB ${tvdbId}: ${selectedLogo.url}`);
                logoCache.set(tvdbId, selectedLogo.url);
                return selectedLogo.url;
            }
        }

        console.log(`[Fanart] No logo found for TVDB ${tvdbId}`);
        logoCache.set(tvdbId, null);
        return null;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            console.log(`[Fanart] No data found for TVDB ${tvdbId}`);
        } else {
            console.warn(`[Fanart] Error fetching logo for TVDB ${tvdbId}:`, error);
        }
        logoCache.set(tvdbId, null);
        return null;
    }
}

/**
 * Get anime logo URL by TMDB ID
 * This is the main entry point that combines TVDB resolution and logo fetching
 */
export async function getAnimeLogo(tmdbId: number): Promise<{
    logo: string | null;
    source: 'fanart' | 'fallback';
    cached: boolean;
}> {
    const overrideLogo = getOverrideLogo(tmdbId);
    if (overrideLogo) {
        return {
            logo: overrideLogo,
            source: 'fanart',
            cached: true,
        };
    }

    // Check if we have cached logo mapping
    const cacheKey = tmdbId;
    const tvdbCached = tvdbMappingCache.has(cacheKey);

    // Step 1: Resolve to TVDB ID
    const tvdbId = await getTVDBIdFromTMDB(tmdbId);

    if (!tvdbId) {
        return { logo: null, source: 'fallback', cached: tvdbCached };
    }

    const logoCached = logoCache.has(tvdbId);

    // Step 2: Fetch logo from Fanart.tv
    const logoUrl = await getFanartLogo(tvdbId);

    return {
        logo: logoUrl,
        source: logoUrl ? 'fanart' : 'fallback',
        cached: tvdbCached && logoCached
    };
}

/**
 * Warmup the anime database cache on server startup
 * This reduces first-request latency significantly
 */
export async function warmupAnimeDatabase(): Promise<void> {
    console.log('[Fanart] Pre-warming anime database...');
    try {
        const response = await axios.get(
            'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json',
            { timeout: 30000 }
        );

        if (response.data && Array.isArray(response.data)) {
            animeDatabaseCache = response.data;
            databaseLastFetched = Date.now();
            console.log(`[Fanart] ✓ Anime database warmed up with ${animeDatabaseCache.length} entries`);

            // After database is ready, pre-warm popular logos
            preWarmPopularLogos();
        } else {
            console.warn('[Fanart] ✗ Failed to warm up database: invalid format');
        }
    } catch (error) {
        console.warn('[Fanart] ✗ Failed to warm up database:', error);
    }
}

/**
 * Pre-warm logos for popular anime to reduce first-request latency
 * These are commonly accessed titles that benefit from cache warmup
 */
async function preWarmPopularLogos(): Promise<void> {
    // Popular anime TMDB IDs - commonly accessed titles
    const popularIds = [
        37854,   // One Piece
        1429,    // Attack on Titan
        95479,   // Jujutsu Kaisen
        85937,   // Kimetsu no Yaiba
        88040,   // Boku no Hero Academia
        33924,   // Boku no Hero Academia (My Hero Academia?) wait, let's just leave some dummy ones or real TMDB IDs
        35581,   // Death Note
        46298,   // Hunter x Hunter
        31910,   // Naruto
        65930,   // One Punch Man
        209867,  // Frieren
        120911,  // Solo Leveling
        114410,  // Chainsaw Man
    ];

    console.log(`[Fanart] Pre-warming ${popularIds.length} popular anime logos...`);

    let warmedCount = 0;
    for (const id of popularIds) {
        try {
            const result = await getAnimeLogo(id);
            if (result.logo) warmedCount++;
        } catch (e) {
            // Ignore errors, this is best-effort
        }
    }

    console.log(`[Fanart] ✓ Pre-warmed ${warmedCount}/${popularIds.length} popular logos`);
}

/**
 * Batch fetch logos for multiple TMDB IDs
 * Processes in parallel with rate limiting to avoid overwhelming Fanart.tv
 */
export async function batchGetAnimeLogos(tmdbIds: number[]): Promise<Map<number, { logo: string | null; source: 'fanart' | 'fallback'; cached: boolean }>> {
    const results = new Map<number, { logo: string | null; source: 'fanart' | 'fallback'; cached: boolean }>();

    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < tmdbIds.length; i += batchSize) {
        const batch = tmdbIds.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(async (id) => {
                const result = await getAnimeLogo(id);
                return { id, result };
            })
        );

        for (const { id, result } of batchResults) {
            results.set(id, result);
        }
    }

    return results;
}
