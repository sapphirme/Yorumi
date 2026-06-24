import axios from 'axios';
import { cacheGet, cacheSet } from '../../utils/redis-cache';

const ANILIST_API_URL = 'https://graphql.anilist.co';
const ONE_DAY_SECONDS = 24 * 60 * 60;
const FIVE_MINUTES_SECONDS = 5 * 60;

const MEDIA_FIELDS = `
    id
    idMal
    title { romaji english native userPreferred }
    coverImage { extraLarge large medium color }
    bannerImage
    description(asHtml: false)
    episodes
    status
    nextAiringEpisode { episode airingAt timeUntilAiring }
    season
    seasonYear
    genres
    tags { id name rank isMediaSpoiler isGeneralSpoiler category }
    averageScore
    meanScore
    popularity
    trailer { id site thumbnail }
    relations {
        edges {
            relationType
            node {
                id
                type
                format
                title { romaji english native userPreferred }
                coverImage { large }
                bannerImage
                episodes
                season
                seasonYear
                startDate { year month day }
                isAdult
            }
        }
    }
    recommendations(perPage: 12, sort: RATING_DESC) {
        nodes {
            mediaRecommendation {
                id
                title { romaji english native userPreferred }
                coverImage { large }
                bannerImage
                averageScore
                isAdult
            }
        }
    }
    characters(sort: [ROLE, RELEVANCE, ID], perPage: 24) {
        edges {
            role
            node { id name { full native } image { large medium } }
            voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
                id
                name { full native }
                image { large medium }
                languageV2
            }
        }
    }
    staff(sort: [RELEVANCE, ID], perPage: 16) {
        edges {
            role
            node { id name { full native } image { large medium } }
        }
    }
    studios { nodes { id name isAnimationStudio } }
    externalLinks { id url site type language color icon notes isDisabled }
    streamingEpisodes { title thumbnail url site }
    rankings { id rank type format year season allTime context }
    trending
    favourites
    isAdult
    countryOfOrigin
    source
    duration
    format
    startDate { year month day }
    endDate { year month day }
    synonyms
    hashtag
`;

type SearchFilters = {
    query?: string;
    page: number;
    perPage: number;
    season?: string;
    seasonYear?: number;
    status?: string;
    format?: string;
    genres?: string[];
    tags?: string[];
    sort?: string[];
};

function toPositiveInt(value: unknown, fallback: number, max = 50) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.floor(parsed), max);
}

function parseList(value: unknown) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseSort(value: unknown, fallback: string[]) {
    const parsed = parseList(value);
    return parsed.length > 0 ? parsed : fallback;
}

function stripAdultNested(media: any) {
    if (!media || typeof media !== 'object') return media;

    if (media.relations?.edges) {
        media.relations.edges = media.relations.edges.filter((edge: any) => !edge?.node?.isAdult);
    }
    if (media.recommendations?.nodes) {
        media.recommendations.nodes = media.recommendations.nodes.filter((node: any) => !node?.mediaRecommendation?.isAdult);
    }

    return media;
}

async function anilistRequest<T>(query: string, variables: Record<string, unknown>, ttlSeconds: number): Promise<T> {
    const cacheKey = `anime:anilist:${Buffer.from(JSON.stringify({ query, variables })).toString('base64url')}`;
    const cached = await cacheGet<T>(cacheKey);
    if (cached) return cached;

    const response = await axios.post(
        ANILIST_API_URL,
        { query, variables },
        {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            timeout: 20_000,
        }
    );

    if (response.data?.errors?.length) {
        throw new Error(response.data.errors.map((error: any) => error?.message || 'AniList error').join('; '));
    }

    const data = response.data as T;
    await cacheSet(cacheKey, data, ttlSeconds);
    return data;
}

function mapStreamingEpisode(episode: any, index: number, fallbackDuration?: number) {
    const numberMatch = String(episode?.title || '').match(/(?:episode|ep\.?)\s*(\d+(?:\.\d+)?)/i);
    const episodeNumber = numberMatch ? Number(numberMatch[1]) : index + 1;

    return {
        id: `anilist:${episodeNumber}`,
        episode: episodeNumber,
        title: episode?.title || `Episode ${episodeNumber}`,
        thumbnail: episode?.thumbnail || null,
        airDate: null,
        length: fallbackDuration || null,
        description: null,
        summary: null,
        url: episode?.url || null,
        site: episode?.site || null,
    };
}

export const streambertAnimeService = {
    parseSearchFilters(query: Record<string, unknown>): SearchFilters {
        return {
            query: String(query.query || query.q || '').trim(),
            page: toPositiveInt(query.page, 1, 500),
            perPage: toPositiveInt(query.perPage || query.limit, 25, 50),
            season: query.season ? String(query.season).toUpperCase() : undefined,
            seasonYear: query.seasonYear || query.year ? toPositiveInt(query.seasonYear || query.year, new Date().getFullYear(), 3000) : undefined,
            status: query.status ? String(query.status).toUpperCase() : undefined,
            format: query.format ? String(query.format).toUpperCase() : undefined,
            genres: parseList(query.genres || query.genre),
            tags: parseList(query.tags || query.tag),
            sort: parseSort(query.sort, ['SEARCH_MATCH']),
        };
    },

    async getMetadata(anilistId: number) {
        const query = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    ${MEDIA_FIELDS}
                }
            }
        `;
        const payload = await anilistRequest<{ data?: { Media?: any } }>(query, { id: anilistId }, ONE_DAY_SECONDS);
        return stripAdultNested(payload.data?.Media || null);
    },

    async search(filters: SearchFilters) {
        const query = `
            query (
                $search: String
                $page: Int
                $perPage: Int
                $season: MediaSeason
                $seasonYear: Int
                $status: MediaStatus
                $format: MediaFormat
                $genres: [String]
                $tags: [String]
                $sort: [MediaSort]
            ) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo { total perPage currentPage lastPage hasNextPage }
                    media(
                        search: $search
                        type: ANIME
                        season: $season
                        seasonYear: $seasonYear
                        status: $status
                        format: $format
                        genre_in: $genres
                        tag_in: $tags
                        sort: $sort
                        isAdult: false
                    ) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;
        const variables = {
            search: filters.query || undefined,
            page: filters.page,
            perPage: filters.perPage,
            season: filters.season,
            seasonYear: filters.seasonYear,
            status: filters.status,
            format: filters.format,
            genres: filters.genres && filters.genres.length > 0 ? filters.genres : undefined,
            tags: filters.tags && filters.tags.length > 0 ? filters.tags : undefined,
            sort: filters.sort,
        };
        const payload = await anilistRequest<{ data?: { Page?: any } }>(query, variables, FIVE_MINUTES_SECONDS);
        const page = payload.data?.Page || { media: [], pageInfo: {} };
        page.media = Array.isArray(page.media) ? page.media.map(stripAdultNested) : [];
        return page;
    },

    async getEpisodes(anilistId: number) {
        const metadata = await this.getMetadata(anilistId);
        if (!metadata) return null;

        const streamingEpisodes = Array.isArray(metadata.streamingEpisodes) ? metadata.streamingEpisodes : [];
        const mapped = streamingEpisodes.map((episode: any, index: number) => mapStreamingEpisode(episode, index, metadata.duration));
        const total = Math.max(Number(metadata.episodes || 0), mapped.length);
        const episodes = mapped.length > 0
            ? mapped
            : Array.from({ length: total }, (_item, index) => ({
                id: `anilist:${index + 1}`,
                episode: index + 1,
                title: `Episode ${index + 1}`,
                thumbnail: metadata.coverImage?.large || metadata.coverImage?.extraLarge || null,
                airDate: null,
                length: metadata.duration || null,
                description: null,
                summary: null,
            }));

        return {
            anilistId,
            season: metadata.season,
            seasonYear: metadata.seasonYear,
            totalEpisodes: total || null,
            episodes,
        };
    },

    async getEpisode(anilistId: number, episodeId: string) {
        const bundle = await this.getEpisodes(anilistId);
        if (!bundle) return null;
        const requested = String(episodeId).replace(/^anilist:/i, '');
        return bundle.episodes.find((episode: any) => String(episode.id) === episodeId || String(episode.episode) === requested) || null;
    },

    async trending(page: number, perPage: number) {
        return this.search({ page, perPage, sort: ['TRENDING_DESC'] });
    },

    async popular(page: number, perPage: number) {
        return this.search({ page, perPage, sort: ['POPULARITY_DESC'] });
    },

    async seasonal(season: string, year: number, page: number, perPage: number) {
        return this.search({ page, perPage, season, seasonYear: year, sort: ['POPULARITY_DESC'] });
    },
};

export const animeQuery = {
    toPositiveInt,
};
