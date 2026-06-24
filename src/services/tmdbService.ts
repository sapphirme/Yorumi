import type { Anime } from '../types/anime';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TOKEN_KEY = 'yorumi_tmdb_read_access_token';
const CACHE_TTL = 10 * 60 * 1000;

type CachedValue<T> = {
    expiresAt: number;
    value: T;
};

type TmdbSearchResult = {
    id: number;
    name?: string;
    original_name?: string;
    title?: string;
    original_title?: string;
    first_air_date?: string;
    release_date?: string;
    origin_country?: string[];
    original_language?: string;
    popularity?: number;
    genre_ids?: number[];
    media_type?: string;
    poster_path?: string;
    vote_average?: number;
};

export type TmdbSeason = {
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    air_date?: string | null;
};

type TmdbTvDetails = {
    id: number;
    name?: string;
    original_name?: string;
    first_air_date?: string;
    seasons?: TmdbSeason[];
};

type TmdbConfig = {
    images?: Record<string, unknown>;
};

export type TmdbEpisode = {
    id: number;
    name: string;
    overview: string;
    episode_number: number;
    season_number: number;
    still_path?: string | null;
    air_date?: string | null;
};

export type TmdbSeasonDetails = {
    _id: string;
    air_date: string;
    episodes: TmdbEpisode[];
    name: string;
    overview: string;
    id: number;
    poster_path: string | null;
    season_number: number;
};

type ValidateResult =
    | { ok: true }
    | { ok: false; reason: 'invalid_token' | 'forbidden' | 'timeout' | 'unreachable' | 'tmdb_error'; status?: number };

const memoryCache = new Map<string, CachedValue<unknown>>();

const normalizeTitle = (value: unknown) =>
    String(value || '')
        .toLowerCase()
        .replace(/\bseason\s*\d+\b/gi, ' ')
        .replace(/\b\d+(st|nd|rd|th)\s*season\b/gi, ' ')
        .replace(/\bcour\s*\d+\b/gi, ' ')
        .replace(/\bpart\s*\d+\b/gi, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '');

const getYear = (value: unknown) => {
    const match = String(value || '').match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : 0;
};

const readToken = () => {
    try {
        return localStorage.getItem(TOKEN_KEY)?.trim() || '';
    } catch {
        return '';
    }
};

const writeToken = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token.trim());
    memoryCache.clear();
};

const buildSignal = (timeoutMs: number) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    return { signal: controller.signal, cleanup: () => window.clearTimeout(timeout) };
};

const tmdbFetch = async <T>(path: string, token = readToken()): Promise<T> => {
    if (!token) throw new Error('TMDB token missing');

    const cacheKey = `${token}:${path}`;
    const cached = memoryCache.get(cacheKey) as CachedValue<T> | undefined;
    if (cached && Date.now() < cached.expiresAt) return cached.value;

    const { signal, cleanup } = buildSignal(8000);
    try {
        const res = await fetch(`${TMDB_BASE}${path}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
            signal,
        });

        if (!res.ok) throw new Error(`TMDB ${res.status}`);

        const value = await res.json() as T;
        memoryCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL });
        return value;
    } finally {
        cleanup();
    }
};

const scoreCandidate = (candidate: TmdbSearchResult, titleTokens: string[], targetYear: number) => {
    const candidateTitles = [candidate.name, candidate.original_name].map(normalizeTitle).filter(Boolean);
    let score = Number(candidate.popularity || 0) / 100;

    for (const target of titleTokens) {
        for (const title of candidateTitles) {
            if (title === target) score += 100;
            else if (title.includes(target) || target.includes(title)) score += 45;
        }
    }

    const year = getYear(candidate.first_air_date);
    if (targetYear && year) score += Math.max(0, 30 - Math.abs(year - targetYear) * 6);
    if (candidate.origin_country?.includes('JP') || candidate.original_language === 'ja') score += 80;
    
    // Yorumi is an anime app; heavily boost Animation genre (16) to prevent live-action dramas from winning
    if (candidate.genre_ids?.includes(16)) score += 200;

    return score;
};

const getAnimeTitles = (anime: Anime) => [
    anime.title_english,
    anime.title_romaji,
    anime.title,
    anime.title_japanese,
    ...(anime.synonyms || []),
].map((title) => String(title || '').trim()).filter(Boolean);

const resolveTvDetails = async (anime: Anime): Promise<TmdbTvDetails | null> => {
    const titles = getAnimeTitles(anime);
    const titleTokens = [...new Set(titles.map(normalizeTitle).filter(Boolean))];
    if (titleTokens.length === 0) return null;

    const targetYear = Number(anime.year || 0);
    const queries = [...new Set(titles.slice(0, 4).map((title) => title
        .replace(/\bseason\s*\d+\b/gi, ' ')
        .replace(/\b\d+(st|nd|rd|th)\s*season\b/gi, ' ')
        .replace(/\bcour\s*\d+\b/gi, ' ')
        .replace(/\bpart\s*\d+\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    ).filter(Boolean))];

    const candidates: TmdbSearchResult[] = [];
    for (const query of queries) {
        const params = new URLSearchParams({ query, include_adult: 'false', language: 'en-US' });
        // Removed strict `first_air_date_year` filtering so we can find parent franchises that started years earlier
        const result = await tmdbFetch<{ results?: TmdbSearchResult[] }>(`/search/tv?${params.toString()}`).catch(() => null);
        candidates.push(...(result?.results || []));
    }

    const best = candidates
        .filter((candidate, index, array) => array.findIndex((item) => item.id === candidate.id) === index)
        .sort((a, b) => scoreCandidate(b, titleTokens, targetYear) - scoreCandidate(a, titleTokens, targetYear))[0];

    if (!best) return null;

    return tmdbFetch<TmdbTvDetails>(`/tv/${best.id}?language=en-US`).catch(() => null);
};

export const tmdbService = {
    getToken: readToken,

    hasToken() {
        return Boolean(readToken());
    },

    saveToken(token: string) {
        writeToken(token);
    },

    async validateToken(token: string): Promise<ValidateResult> {
        const trimmed = token.trim();
        if (!trimmed) return { ok: false, reason: 'invalid_token' };

        const { signal, cleanup } = buildSignal(7000);
        try {
            const config = await fetch(`${TMDB_BASE}/configuration`, {
                headers: { Authorization: `Bearer ${trimmed}`, Accept: 'application/json' },
                signal,
            });

            if (config.status === 401) return { ok: false, reason: 'invalid_token' };
            if (config.status === 403) return { ok: false, reason: 'forbidden' };
            if (!config.ok) return { ok: false, reason: 'tmdb_error', status: config.status };

            await config.json() as TmdbConfig;
            return { ok: true };
        } catch (error) {
            const name = error instanceof Error ? error.name : '';
            return { ok: false, reason: name === 'AbortError' ? 'timeout' : 'unreachable' };
        } finally {
            cleanup();
        }
    },

    async getTvSeasonsForAnime(anime: Anime): Promise<TmdbSeason[]> {
        const details = await resolveTvDetails(anime);
        return (details?.seasons || []).filter((season) => Number(season.season_number) > 0);
    },

    async getTvSeasonEpisodes(anime: Anime, seasonNumber: number): Promise<TmdbEpisode[]> {
        const details = await resolveTvDetails(anime);
        if (!details) return [];
        const seasonData = await tmdbFetch<TmdbSeasonDetails>(`/tv/${details.id}/season/${seasonNumber}?language=en-US`).catch(() => null);
        return seasonData?.episodes || [];
    },

    async searchMulti(query: string): Promise<TmdbSearchResult[]> {
        const params = new URLSearchParams({ query, include_adult: 'false', language: 'en-US' });
        const result = await tmdbFetch<{ results?: TmdbSearchResult[] }>(`/search/multi?${params.toString()}`).catch(() => null);
        return (result?.results || []).filter((r) => r.media_type !== 'person');
    },

    isAnimeContent(item: TmdbSearchResult): boolean {
        const lang = item.original_language;
        const countries = item.origin_country || [];
        const genreIds = item.genre_ids || [];
        const hasAnimation = genreIds.includes(16);
        return hasAnimation && (lang === 'ja' || countries.includes('JP'));
    },

    async resolveTmdbToAnilist(tmdbId: string): Promise<Anime | null> {
        try {
            // First try as TV, if fails, try as Movie
            let title = '';
            let isTv = true;
            try {
                const tvDetails = await tmdbFetch<any>(`/tv/${tmdbId}?language=en-US`);
                title = tvDetails.name || tvDetails.original_name;
            } catch {
                const movieDetails = await tmdbFetch<any>(`/movie/${tmdbId}?language=en-US`);
                title = movieDetails.title || movieDetails.original_title;
                isTv = false;
            }

            if (!title) return null;

            // Search AniList
            const { animeService } = await import('./animeService');
            const { data } = await animeService.searchAnime(title, 1, 3);
            
            if (data && data.length > 0) {
                return data[0] as Anime;
            }
            return null;
        } catch (err) {
            console.error('Failed to resolve TMDB ID to AniList', err);
            return null;
        }
    },
};
