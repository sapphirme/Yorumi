import { animeService } from './animeService';
import type { Anime } from '../types/anime';
import { getDisplayImageUrl } from '../utils/image';

export type YumiRecommendationSeed = {
    title: string;
};

export type YumiRecommendationCard = {
    title: string;
    image: string;
    score?: number;
    year?: number | string;
    synopsis?: string;
    trailerUrl?: string;
    item?: Anime;
};

const animeMatchCache = new Map<string, Promise<Anime | undefined>>();

const normalizeTitle = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\b(?:the|tv|movie|film|ova|ona|special|season)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const getSearchTitle = (title: string) =>
    title
        .replace(/^\s*\d+\.\s*/, '')
        .replace(/\s*\((?:19|20)\d{2}\)\s*$/i, '')
        .replace(/\s*\((?:tv|movie|film|ova|ona|special)\)\s*$/i, '')
        .replace(/\s*[-–—]\s*(?:tv|movie|film|ova|ona|special)\s*$/i, '')
        .trim();

const getAnimeTitles = (item: Anime) => [
    item.title,
    item.title_english,
    item.title_japanese,
    item.title_romaji,
    ...(item.synonyms || []),
].filter((title): title is string => Boolean(title?.trim()));

const scoreAnimeMatch = (seedTitle: string, item: Anime) => {
    const query = normalizeTitle(seedTitle);
    const candidateTitles = getAnimeTitles(item).map(normalizeTitle).filter(Boolean);
    if (!query || candidateTitles.length === 0) return 0;

    let score = 0;
    for (const candidate of candidateTitles) {
        if (candidate === query) score = Math.max(score, 100);
        else if (candidate.startsWith(`${query} `) || query.startsWith(`${candidate} `)) score = Math.max(score, 82);
        else if (candidate.includes(query) || query.includes(candidate)) score = Math.max(score, 68);
    }

    const popularity = Number((item as Anime & { popularity?: number }).popularity || 0);
    if (popularity > 100000) score += 4;
    if (item.images?.jpg?.large_image_url || item.images?.jpg?.image_url) score += 8;

    return score;
};

const isSpecialLikeSeed = (title: string) => /\b(?:specials?|ova|ona|oav|recap|extra|side story|sidestory|omake|shorts?)\b/i.test(title);

const scoreFormatFit = (seedTitle: string, item: Anime) => {
    const type = String(item.type || '').trim().toLowerCase();
    const title = `${item.title || ''} ${item.title_english || ''} ${item.title_romaji || ''}`;
    const userAskedForSpecial = isSpecialLikeSeed(seedTitle);
    const looksSpecial =
        /\b(?:specials?|ova|ona|oav|recap|extra|side story|sidestory|omake|shorts?)\b/i.test(title) ||
        ['special', 'ova', 'ona', 'music'].includes(type);

    if (userAskedForSpecial) return looksSpecial ? 12 : 0;

    let score = 0;
    if (type === 'tv') score += 18;
    else if (type === 'movie') score += 14;
    else if (type === 'tv special') score -= 8;
    else if (['special', 'ova', 'ona', 'music'].includes(type)) score -= 35;

    if (looksSpecial) score -= 45;
    if (typeof item.episodes === 'number' && item.episodes > 1) score += 6;
    if (typeof item.score === 'number' && item.score > 0) score += Math.min(10, Math.max(0, item.score - 5));

    return score;
};

const pickBestAnimeMatch = (seedTitle: string, items: Anime[]) => {
    const ranked = items
        .map((item) => ({ item, score: scoreAnimeMatch(seedTitle, item) + scoreFormatFit(seedTitle, item) }))
        .sort((left, right) => right.score - left.score);

    return ranked[0]?.score >= 60 ? ranked[0].item : items.find((item) => item.images?.jpg?.large_image_url || item.images?.jpg?.image_url);
};

export const extractRecommendationSeeds = (reply: string, limit = 6): YumiRecommendationSeed[] => {
    const seeds = new Map<string, YumiRecommendationSeed>();
    const addSeed = (rawTitle: string) => {
        const title = rawTitle.replace(/^\s*\d+\.\s*/, '').trim();
        const key = normalizeTitle(title);
        if (!title || !key || seeds.has(key)) return;

        seeds.set(key, { title });
    };

    const animeBlockMatch = reply.match(/\[ANIME\]([\s\S]*?)\[\/ANIME\]/i);
    if (animeBlockMatch) {
        try {
            const titles = JSON.parse(animeBlockMatch[1].trim()) as unknown;
            if (Array.isArray(titles)) {
                titles.forEach((title) => {
                    if (typeof title === 'string' && seeds.size < limit + 2) addSeed(title);
                });
            }
        } catch {
            // Fall back to markdown title extraction below.
        }
    }

    if (seeds.size > 0) return Array.from(seeds.values()).slice(0, limit);

    const splitBoldTitlePattern = /\*\*([^*]+)\*\*\s*\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = splitBoldTitlePattern.exec(reply)) && seeds.size < limit) {
        addSeed(match[1]);
    }

    const inlineBoldTitlePattern = /\*\*([^*]+?)\s*\(([^)]*)\)\*\*/g;
    while ((match = inlineBoldTitlePattern.exec(reply)) && seeds.size < limit) {
        addSeed(match[1]);
    }

    return Array.from(seeds.values()).slice(0, limit);
};

export const cleanYumiReply = (reply: string) =>
    reply
        .replace(/^\s*(?:here (?:are|is)(?: my)?|top)\s+\d*\s*(?:anime)?\s*(?:recommendations?)?(?:\s+with[^:\n]*)?:\s*/i, '')
        .replace(/^\s*(?:i recommend|sure[,!]?)\s*:?\s*/i, '')
        .trim();

const stripAnimeBlock = (reply: string) => reply.replace(/\s*\[ANIME\][\s\S]*?\[\/ANIME\]\s*/gi, '').trim();

const getFirstRecommendationIndex = (reply: string) => {
    const patterns = [
        /\[ANIME\]/i,
        /(?:^|\n)\s*(?:\d+\.|-|\*)?\s*\*\*[^*]+\*\*\s*\(/,
        /\*\*[^*]+?\s*\([^)]*\)\*\*/,
    ];
    const indexes = patterns
        .map((pattern) => reply.search(pattern))
        .filter((index) => index >= 0);

    return indexes.length > 0 ? Math.min(...indexes) : -1;
};

export const getIntroReply = (reply: string) => {
    const seeds = extractRecommendationSeeds(reply);
    const recommendationStart = getFirstRecommendationIndex(reply);
    const intro = stripAnimeBlock(recommendationStart >= 0 ? reply.slice(0, recommendationStart).trim() : reply.trim());
    if (seeds.length > 0 && intro.length > 0 && intro.length <= 260) return intro;
    if (intro.length > 0 && intro.length <= 220) return intro;

    const fallback = intro || stripAnimeBlock(reply);
    return fallback.length > 220 ? `${fallback.slice(0, 217).trim()}...` : fallback;
};

const toRecommendationCard = (seed: YumiRecommendationSeed, item: Anime): YumiRecommendationCard => {
    const year = item.year || undefined;
    const trailer = 'trailer' in item ? item.trailer : undefined;
    const trailerUrl = trailer?.site === 'youtube' && trailer.id
        ? `https://www.youtube.com/watch?v=${trailer.id}`
        : undefined;

    return {
        title: item.title || seed.title,
        image: getDisplayImageUrl(item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || ''),
        score: typeof item.score === 'number' ? item.score : undefined,
        year,
        synopsis: item.synopsis || '',
        trailerUrl,
        item,
    };
};

const toSeedRecommendationCard = (seed: YumiRecommendationSeed): YumiRecommendationCard => ({
    title: seed.title,
    image: '',
    synopsis: 'Yumi recommended this title, but Yorumi could not match it to the anime catalog yet.',
});

const resolveAnimeSeed = (seed: YumiRecommendationSeed) => {
    const searchTitle = getSearchTitle(seed.title);
    const cacheKey = normalizeTitle(searchTitle || seed.title);
    const cached = animeMatchCache.get(cacheKey);
    if (cached) return cached;

    const request = animeService.searchAnime(searchTitle || seed.title, 1, 12)
        .then((result) => pickBestAnimeMatch(seed.title, (result.data || []) as Anime[]))
        .catch(() => undefined);

    animeMatchCache.set(cacheKey, request);
    return request;
};

export const resolveRecommendationCards = async (reply: string, limit = 6): Promise<YumiRecommendationCard[]> => {
    const seeds = extractRecommendationSeeds(reply, limit);
    if (seeds.length === 0) return [];

    const cards = await Promise.all(seeds.map(async (seed) => {
        const item = await resolveAnimeSeed(seed);
        return item ? toRecommendationCard(seed, item) : toSeedRecommendationCard(seed);
    }));

    return cards;
};
