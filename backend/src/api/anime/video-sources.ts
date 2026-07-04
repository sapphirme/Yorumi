import axios from 'axios';
import { AllMangaScraper } from '../../scraper/allmanga';
import { cacheGet, cacheSet } from '../../utils/redis-cache';
import { logger } from '../../core/logger';
import { streambertAnimeService } from './anime.service';

type SubtitleTrack = { lang: string; url: string };
type StreamResponse = {
    m3u8: string;
    subtitles: SubtitleTrack[];
    source: string;
    episode: number;
    title?: string;
    referer?: string;
};

type VideoSource = {
    id: string;
    getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number }): Promise<StreamResponse | null>;
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
const STREAM_TTL_SECONDS = 5 * 60; // 5 minutes — short TTL prevents stale wrong-episode links

function absoluteUrl(url: string, baseUrl: string) {
    if (/^https?:\/\//i.test(url)) return url;
    return new URL(url, baseUrl).href;
}

function extractSubtitles(html: string, baseUrl: string): SubtitleTrack[] {
    const subtitles: SubtitleTrack[] = [];
    const seen = new Set<string>();
    const pattern = /["']([^"']+\.vtt[^"']*)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html))) {
        const url = absoluteUrl(match[1], baseUrl);
        if (seen.has(url)) continue;
        seen.add(url);
        const langMatch = url.match(/(?:^|[._/-])([a-z]{2})(?:[._/-]|\.vtt|\?)/i);
        subtitles.push({ lang: langMatch?.[1]?.toLowerCase() || 'und', url });
    }
    return subtitles;
}

async function getEpisodeTitle(anilistId: number, episode: number) {
    const details = await streambertAnimeService.getEpisodes(anilistId).catch(() => null);
    const match = details?.episodes?.find((item: any) => Number(item?.episode) === episode);
    return match?.title;
}

class VideasySource implements VideoSource {
    id = 'videasy';

    async getStream(anilistId: number, episode: number): Promise<StreamResponse | null> {
        const baseUrl = String(process.env.VIDEASY_BASE_URL || 'https://player.videasy.to').replace(/\/+$/, '');
        const playerUrl = `${baseUrl}/anime/${anilistId}/${episode}`;
        
        try {
            const response = await axios.get<string>(playerUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    Referer: 'https://videasy.to',
                    Accept: 'text/html,application/xhtml+xml',
                },
                timeout: 15_000,
            });
            const html = String(response.data || '');
            const match = html.match(/(?:file|src)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i);
            
            if (match?.[1]) {
                const m3u8Url = absoluteUrl(match[1], baseUrl);
                return {
                    m3u8: `/api/scraper/proxy?url=${encodeURIComponent(m3u8Url)}&referer=${encodeURIComponent(baseUrl)}`,
                    subtitles: extractSubtitles(html, baseUrl),
                    source: this.id,
                    episode,
                    title: await getEpisodeTitle(anilistId, episode),
                    referer: baseUrl,
                };
            }
        } catch (error) {
            // Ignore extraction errors and fallback to iframe
        }

        return {
            m3u8: playerUrl,
            subtitles: [],
            source: this.id,
            episode,
            title: await getEpisodeTitle(anilistId, episode),
            referer: baseUrl,
        };
    }
}

class EmbedSource implements VideoSource {
    constructor(public id: string, private baseUrl: string) {}

    async getStream(tmdbId: number, episode: number, options?: { title?: string }): Promise<StreamResponse | null> {
        let playerUrl = `${this.baseUrl.replace(/\/+$/, '')}/anime/${tmdbId}/${episode}`;

        if (this.id === 'vidsrc') {
            const tmdbService = require('../scraper/tmdb.service').tmdbService;
            const target = await tmdbService.resolveMediaTarget({ title: options?.title || '' });
            if (target?.mediaType === 'movie') {
                playerUrl = `${this.baseUrl.replace(/\/+$/, '')}/embed/movie/${tmdbId}`;
            } else {
                const season = options?.title ? await tmdbService.resolveSeasonByTitle(tmdbId, options.title) : 1;
                playerUrl = `${this.baseUrl.replace(/\/+$/, '')}/embed/tv/${tmdbId}/${season || 1}/${episode}`;
            }
            return {
                m3u8: playerUrl,
                subtitles: [],
                source: this.id,
                episode,
                title: await getEpisodeTitle(tmdbId, episode),
                referer: this.baseUrl,
            };
        }

        try {
            const response = await axios.get<string>(playerUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    Referer: this.baseUrl,
                },
                timeout: 15_000,
            });
            const html = String(response.data || '');
            const match = html.match(/(?:file|src)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i);
            
            if (match?.[1]) {
                return {
                    m3u8: absoluteUrl(match[1], this.baseUrl),
                    subtitles: extractSubtitles(html, this.baseUrl),
                    source: this.id,
                    episode,
                    title: await getEpisodeTitle(tmdbId, episode),
                    referer: this.baseUrl,
                };
            }
        } catch (error) {
            // Ignore extraction errors and fallback to iframe
        }

        return {
            m3u8: playerUrl,
            subtitles: [],
            source: this.id,
            episode,
            title: await getEpisodeTitle(tmdbId, episode),
            referer: this.baseUrl,
        };
    }
}

class AllMangaSource implements VideoSource {
    id = 'allmanga';
    private scraper = new AllMangaScraper();

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number }): Promise<StreamResponse | null> {
        const metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId) : null;
        const title = options?.title || metadata?.title?.english || metadata?.title?.romaji || metadata?.title?.native;
        if (!title) return null;

        const links = await this.scraper.getLinksForEpisodeNumber(title, episode);
        const best = links
            .filter((link) => {
                const u = link?.directUrl || link?.url || '';
                return u && !/streamsb|sbvideo|sbfull|sbspeed|sbfast|streamtape|embedsito/i.test(u);
            })
            .sort((a, b) => {
                const directA = a.directUrl ? 100_000 : 0;
                const directB = b.directUrl ? 100_000 : 0;
                const qualityA = Number(String(a.quality || '').replace(/[^\d]/g, '')) || 0;
                const qualityB = Number(String(b.quality || '').replace(/[^\d]/g, '')) || 0;
                const subA = String(a.audio || '').toLowerCase() === 'sub' ? 10_000 : 0;
                const subB = String(b.audio || '').toLowerCase() === 'sub' ? 10_000 : 0;
                return (directB + subB + qualityB) - (directA + subA + qualityA);
            })[0];
        const url = best?.directUrl || best?.url;
        if (!url) return null;

        return {
            m3u8: url,
            subtitles: best.subtitles || [],
            source: this.id,
            episode,
            title: await getEpisodeTitle(anilistId, episode),
            referer: best.referer || 'https://allmanga.to',
        };
    }
}

export class AniNekoSource implements VideoSource {
    id = 'anineko';

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number }): Promise<StreamResponse | null> {
        const metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId) : null;
        const title = options?.title || metadata?.title?.romaji || metadata?.title?.english || metadata?.title?.native;
        console.log(`[AniNeko] resolved title for id ${anilistId}: ${title}`, metadata ? 'Metadata exists' : 'Metadata null');
        if (!title) return null;

        try {
            const searchUrl = `https://anineko.to/browser?keyword=${encodeURIComponent(title)}`;
            const searchHtml = await axios.get<string>(searchUrl, {
                headers: { 'User-Agent': USER_AGENT }
            }).then(r => r.data);
            
            const slugMatches = [...searchHtml.matchAll(/<a\b[^>]*href=["']\/watch\/([^/?#"']+)["']/gi)];
            if (slugMatches.length === 0) {
                console.log(`[AniNeko] slugMatch failed for ${title}. URL: ${searchUrl}`);
                return null;
            }

            // Score all slug candidates — prefer exact or best partial match
            const expectedSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const expectedWords = expectedSlug.replace(/-/g, ' ');
            const scoredSlugs = slugMatches.map(m => {
                const slug = m[1];
                const slugWords = slug.replace(/-/g, ' ');
                let score = 0;
                if (slug === expectedSlug) score += 1000;
                else if (slugWords === expectedWords) score += 900;
                else if (slugWords.includes(expectedWords) || expectedWords.includes(slugWords)) score += 500;
                // Penalize dub/special/movie variants
                if (/-dub$/i.test(slug)) score -= 200;
                if (/\b(movie|ova|ona|special|recap)\b/i.test(slugWords) && !/\b(movie|ova|ona|special|recap)\b/i.test(expectedWords)) score -= 500;
                return { slug, score };
            });
            scoredSlugs.sort((a, b) => b.score - a.score);
            const slug = scoredSlugs[0].slug;

            const epUrl = `https://anineko.to/watch/${slug}/ep-${episode}`;
            const epHtml = await axios.get<string>(epUrl, {
                headers: { 'User-Agent': USER_AGENT, Referer: `https://anineko.to/watch/${slug}` }
            }).then(r => r.data);

            const embedMatches = [...epHtml.matchAll(/data-video=["']([^"']+)["']/gi)];
            if (embedMatches.length === 0) return null;
            
            let embedUrl = embedMatches[0][1].replace(/&amp;/g, '&');
            embedUrl = embedUrl.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));

            const embedHtml = await axios.get<string>(embedUrl, {
                headers: { 'User-Agent': USER_AGENT, Referer: 'https://anineko.to/' }
            }).then(r => r.data).catch(() => '');

            const hlsMatch = embedHtml.match(/const\s+src\s*=\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i)
                || embedHtml.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i)
                || embedHtml.match(/["'](https?:\/\/[^"']+\/master\.m3u8[^"']*)["']/i);
                
            const m3u8 = hlsMatch ? hlsMatch[1] : embedUrl;
            
            let cleanReferer = embedUrl;
            const subs: SubtitleTrack[] = [];
            const subMatch = embedUrl.match(/[?&]sub=([^&]+)/i);
            if (subMatch) {
                subs.push({ lang: 'eng', url: decodeURIComponent(subMatch[1]) });
                cleanReferer = embedUrl.split('?')[0];
            }

            return {
                m3u8,
                subtitles: subs,
                source: this.id,
                episode,
                title: await getEpisodeTitle(anilistId, episode),
                referer: cleanReferer
            };
        } catch (e: any) {
            console.error(`AniNeko failed for title ${title}:`, e?.message || e);
            return null;
        }
    }
}

class AnimeGGSource implements VideoSource {
    id = 'animegg';

    async getStream(anilistId: number, episode: number, options?: { title?: string, tmdbId?: number }): Promise<StreamResponse | null> {
        const metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId) : null;
        const title = options?.title || metadata?.title?.romaji || metadata?.title?.english || metadata?.title?.native;
        if (!title) return null;

        try {
            const searchTitles = [
                title,
                metadata?.title?.romaji,
                metadata?.title?.english,
                metadata?.title?.native
            ].filter(Boolean) as string[];

            let searchHtml = '';
            let slugMatches: RegExpMatchArray[] = [];

            for (const searchTitle of searchTitles) {
                searchHtml = await axios.get<string>(`https://www.animegg.org/search/?q=${encodeURIComponent(searchTitle)}`, {
                    headers: { 'User-Agent': USER_AGENT }
                }).then(r => r.data).catch(() => '');
                
                slugMatches = [...searchHtml.matchAll(/<a\b[^>]*href=["']\/series\/([^/?#"']+)["']/gi)];
                if (slugMatches.length > 0) break;
            }

            if (slugMatches.length === 0) {
                console.log(`[AnimeGG] slugMatch failed for all titles of ${title}`);
                return null;
            }
            
            const altTitles = [
                title,
                metadata?.title?.romaji,
                metadata?.title?.english,
                ...(metadata?.synonyms || [])
            ].filter(Boolean) as string[];

            const altExpectedSlugs = altTitles.map(t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
            const altExpectedWordsList = altExpectedSlugs.map(slug => slug.replace(/-/g, ' '));

            const scoredSlugs = slugMatches.map(m => {
                const slug = m[1];
                const slugWords = slug.replace(/-/g, ' ');
                let bestScore = -9999;

                for (let i = 0; i < altExpectedSlugs.length; i++) {
                    const expectedSlug = altExpectedSlugs[i];
                    const expectedWords = altExpectedWordsList[i];
                    let score = 0;

                    if (slug === expectedSlug) score += 1000;
                    if (slugWords === expectedWords) score += 1000;
                    if (slugWords.includes(expectedWords) || expectedWords.includes(slugWords)) score += 500;
                    
                    if (slugWords.replace(/u/g, '') === expectedWords.replace(/u/g, '')) score += 800;

                    const isSpecial = /\b(movie|ova|ona|special|recap)\b/i.test(slugWords);
                    const asksSpecial = /\b(movie|ova|ona|special|recap)\b/i.test(expectedWords);
                    if (isSpecial && !asksSpecial) score -= 2000;

                    if (slug.endsWith('-dub')) score -= 10;
                    
                    if (score > bestScore) bestScore = score;
                }

                return { slug, score: bestScore };
            });

            scoredSlugs.sort((a, b) => b.score - a.score);
            const slug = scoredSlugs[0].slug;

            const seriesHtml = await axios.get<string>(`https://www.animegg.org/series/${slug}`, {
                headers: { 'User-Agent': USER_AGENT }
            }).then(r => r.data);
            
            const liPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
            let epSlug = null;
            let m;
            while ((m = liPattern.exec(seriesHtml))) {
                const block = m[1];
                if (!block.includes('anm_det_pop')) continue;
                
                const hrefMatch = block.match(/href=["']\/([^"']+)["']/i);
                const strongMatch = block.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
                if (hrefMatch && strongMatch) {
                    const strongText = strongMatch[1].replace(/<[^>]+>/g, '').trim();
                    // Handle single ep ("12"), ranges ("1-13"), and decimal ("12.5")
                    const rangeMatch = strongText.match(/(\d+)\s*-\s*(\d+)\s*$/);
                    const singleMatch = strongText.match(/(\d+(?:\.\d+)?)\s*$/);
                    let epMatch = false;
                    if (rangeMatch) {
                        // Range: episode must be within [start, end]
                        const start = parseInt(rangeMatch[1]);
                        const end = parseInt(rangeMatch[2]);
                        epMatch = episode >= start && episode <= end;
                    } else if (singleMatch) {
                        epMatch = parseFloat(singleMatch[1]) === episode;
                    }
                    if (epMatch) {
                        epSlug = hrefMatch[1].replace(/#.*$/, '');
                        break;
                    }
                }
            }
            if (!epSlug) return null;

            const watchHtml = await axios.get<string>(`https://www.animegg.org/${epSlug}`, {
                headers: { 'User-Agent': USER_AGENT, Referer: 'https://www.animegg.org' }
            }).then(r => r.data);

            const embedMatch = watchHtml.match(/<iframe\b[^>]*src=["']\/embed\/([^"']+)["']/i);
            if (!embedMatch) {
                console.log(`[AnimeGG] embedMatch failed for ${title} ep ${episode}`);
                return null;
            }
            const embedId = embedMatch[1];
            const embedUrl = `https://www.animegg.org/embed/${embedId}`;

            const embedHtml = await axios.get<string>(embedUrl, {
                headers: { 'User-Agent': USER_AGENT, Referer: `https://www.animegg.org` }
            }).then(r => r.data);

            const srcMatch = embedHtml.match(/var\s+videoSources\s*=\s*\[\{.*?file\s*:\s*["']([^"']+)["']/i);
            if (!srcMatch) return null;
            
            let url = srcMatch[1];
            if (!url.startsWith('http')) url = `https://www.animegg.org${url}`;

            return {
                m3u8: url,
                subtitles: [],
                source: this.id,
                episode,
                title: await getEpisodeTitle(anilistId, episode),
                referer: embedUrl
            };
        } catch (e: any) {
            console.error(`AnimeGG failed for title ${title}:`, e?.message || e);
            return null;
        }
    }
}

const sources: VideoSource[] = [
    new EmbedSource('vidsrc', 'https://vsembed.su'),
    new AllMangaSource(),
    new AniNekoSource(),
    new AnimeGGSource(),
];

function orderedSources(requested: string) {
    if (requested === 'auto') return sources;
    const source = requested ? sources.find((item) => item.id === requested) : null;
    return source ? [source] : sources;
}

export const animeVideoSources = {
    async getStream(anilistId: number, episode: number, requestedSource = 'vidsrc', options?: { title?: string, tmdbId?: number }, nocache = false): Promise<StreamResponse | null> {
        const sourceId = String(requestedSource || 'vidsrc').trim().toLowerCase();
        const cacheKey = `anime:stream:v2:${anilistId}:${episode}:${sourceId}`;
        if (!nocache) {
            const cached = await cacheGet<StreamResponse>(cacheKey);
            if (cached) return cached;
        }

        const metadata = options?.tmdbId ? await streambertAnimeService.getMetadata(options.tmdbId) : null;
        const isMovie = metadata?.format === 'MOVIE';
        const ttl = isMovie ? 300 : STREAM_TTL_SECONDS;

        const sourcesToTry = orderedSources(sourceId);
        for (const source of sourcesToTry) {
            try {
                const result = await source.getStream(anilistId, episode, options);
                if (result?.m3u8) {
                    await cacheSet(cacheKey, result, ttl);
                    return result;
                }
            } catch (error) {
                logger.warn(`[anime-stream] ${source.id} failed for AniList ${anilistId} episode ${episode}`, error);
            }
        }

        return null;
    },
};
