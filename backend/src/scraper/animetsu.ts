/**
 * Animetsu Spotlight Scraper
 *
 * Fetches trending anime titles from animetsu.net's home API and maps them
 * into the AniList media shape expected by the spotlight pipeline.
 */

import axios from 'axios';

const ANIMETSU_HOME_URL = 'https://animetsu.net/v2/api/anime/home';
const REQUEST_TIMEOUT_MS = 8000;

interface AnimetsuTitle {
    romaji: string | null;
    english: string | null;
    native: string | null;
}

interface AnimetsuCoverImage {
    large: string | null;
    medium: string | null;
    small: string | null;
}

interface AnimetsuNextAiringEp {
    airing_at: number;
    ep_num: number;
    time_left: number;
}

interface AnimetsuStudio {
    name: string;
    anilist_id: number;
    is_main: boolean;
}

interface AnimetsuTrendingItem {
    id: string;
    anilist_id: number;
    type: string;
    title: AnimetsuTitle;
    status: string;
    is_adult: boolean;
    color: string | null;
    clear_logo: string | null;
    cover_image: AnimetsuCoverImage;
    banner: string | null;
    description: string | null;
    source: string | null;
    total_eps: number | null;
    start_date: string | null;
    end_date: string | null;
    year: number | null;
    format: string | null;
    next_airing_ep: AnimetsuNextAiringEp | null;
    duration: number | null;
    genres: string[];
    average_score: number | null;
    trailer: string | null;
    season: string | null;
    studios: AnimetsuStudio[];
}

/**
 * Map an Animetsu trending item into the AniList media shape expected by
 * `wrapAniListMediaItems` and `getNativeSpotlightAnime` consumers.
 */
function mapToAniListShape(item: AnimetsuTrendingItem): any {
    const mainStudio = item.studios?.find((s) => s.is_main);
    return {
        id: item.anilist_id || 0,
        idMal: item.anilist_id || 0,
        title: {
            romaji: item.title?.romaji || null,
            english: item.title?.english || null,
            native: item.title?.native || null,
        },
        description: item.description || null,
        bannerImage: item.banner || null,
        coverImage: {
            extraLarge: item.cover_image?.large || null,
            large: item.cover_image?.large || item.cover_image?.medium || null,
        },
        format: item.format || 'TV',
        episodes: item.total_eps || null,
        duration: item.duration || null,
        status: item.status || 'RELEASING',
        season: item.season || null,
        seasonYear: item.year || null,
        startDate: item.year
            ? { year: item.year, month: null, day: null }
            : null,
        endDate: null,
        averageScore: item.average_score || null,
        meanScore: item.average_score || null,
        popularity: 0,
        genres: item.genres || [],
        studios: {
            nodes: mainStudio
                ? [{ name: mainStudio.name }]
                : item.studios?.length
                    ? [{ name: item.studios[0].name }]
                    : [],
        },
        isAdult: item.is_adult || false,
        countryOfOrigin: 'JP',
        nextAiringEpisode: item.next_airing_ep
            ? {
                episode: item.next_airing_ep.ep_num,
                airingAt: item.next_airing_ep.airing_at,
            }
            : null,
        trailer: item.trailer
            ? { id: item.trailer, site: 'youtube', thumbnail: null }
            : null,
        synonyms: [],
    };
}

// In-memory cache
let spotlightCache: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch trending anime from Animetsu and return them in AniList media shape.
 * Returns up to `limit` items, filtered to exclude adult content and items
 * without imagery.
 */
export async function getAnimetsuSpotlight(limit: number = 8): Promise<any[]> {
    const now = Date.now();
    if (spotlightCache && now - spotlightCache.timestamp < CACHE_TTL_MS) {
        return spotlightCache.data.slice(0, limit);
    }

    try {
        const response = await axios.get(ANIMETSU_HOME_URL, {
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
                'Referer': 'https://animetsu.net/',
                'Origin': 'https://animetsu.net',
                'Accept': 'application/json',
            },
        });

        const trending: AnimetsuTrendingItem[] = Array.isArray(response.data?.trending)
            ? response.data.trending
            : [];

        const mapped = trending
            .filter((item) => !item.is_adult)
            .filter((item) => item.cover_image?.large || item.banner)
            .map(mapToAniListShape);

        if (mapped.length > 0) {
            spotlightCache = { data: mapped, timestamp: now };
            console.log(`[Animetsu] Cached ${mapped.length} spotlight items`);
        }

        return mapped.slice(0, limit);
    } catch (error: any) {
        console.error('[Animetsu] Failed to fetch spotlight:', error?.message || error);

        // Return stale cache if available
        if (spotlightCache?.data?.length) {
            console.log('[Animetsu] Returning stale cache');
            return spotlightCache.data.slice(0, limit);
        }

        return [];
    }
}
