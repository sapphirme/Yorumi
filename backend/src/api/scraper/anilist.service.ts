import axios from 'axios';
import { cacheGet, cacheSet } from '../../utils/redis-cache';

export type AnilistSeasonResult = {
    title: string;
    romaji: string | null;
    episodes: number | null;
    nextTitle: string | null;
    nextRomaji: string | null;
};

class AnilistService {
    private async gql(query: string, variables: any) {
        const { data } = await axios.post(
            'https://graphql.anilist.co',
            { query, variables },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                timeout: 8000,
            }
        );
        return data;
    }

    async resolveSeasonTitle(baseTitle: string, seasonNumber: number): Promise<AnilistSeasonResult> {
        const fallback: AnilistSeasonResult = {
            title: baseTitle,
            romaji: null,
            episodes: null,
            nextTitle: null,
            nextRomaji: null,
        };

        const cacheKey = `anilist:season:${baseTitle}:${seasonNumber}`;
        const cached = await cacheGet<AnilistSeasonResult>(cacheKey).catch(() => null);
        if (cached) return cached;

        try {
            const query = `query($search:String){Media(search:$search,type:ANIME,sort:SEARCH_MATCH){title{english romaji}episodes relations{edges{relationType node{type format title{english romaji}episodes startDate{year}seasonYear}}}}}`;
            const data = await this.gql(query, { search: baseTitle });
            const media = data?.data?.Media;
            if (!media) return fallback;

            const resolveS1 = seasonNumber <= 1;
            const s1Romaji = media.title?.romaji || null;
            const s1Episodes = media.episodes || null;

            const sequels = (media.relations?.edges || [])
                .filter((e: any) =>
                    e.relationType === 'SEQUEL' &&
                    e.node?.type === 'ANIME' &&
                    (e.node?.format === 'TV' || e.node?.format === 'TV_SHORT')
                )
                .sort((a: any, b: any) => {
                    const ya = a.node.startDate?.year || a.node.seasonYear || 9999;
                    const yb = b.node.startDate?.year || b.node.seasonYear || 9999;
                    return ya - yb;
                });

            const getTitle = (node: any) => node.title?.english || node.title?.romaji || null;
            const getRomaji = (node: any) => node.title?.romaji || null;

            let result: AnilistSeasonResult;

            if (resolveS1) {
                const next = sequels[0]?.node ?? null;
                result = {
                    title: media.title?.english || baseTitle,
                    romaji: s1Romaji,
                    episodes: s1Episodes,
                    nextTitle: next ? getTitle(next) : null,
                    nextRomaji: next ? getRomaji(next) : null,
                };
            } else {
                const target = sequels[seasonNumber - 2];
                if (!target) {
                    result = { ...fallback, romaji: s1Romaji, episodes: s1Episodes };
                } else {
                    const nextNode = sequels[seasonNumber - 1]?.node ?? null;
                    result = {
                        title: getTitle(target.node) || baseTitle,
                        romaji: getRomaji(target.node) || s1Romaji,
                        episodes: target.node.episodes || null,
                        nextTitle: nextNode ? getTitle(nextNode) : null,
                        nextRomaji: nextNode ? getRomaji(nextNode) : null,
                    };
                }
            }

            cacheSet(cacheKey, result, 7 * 24 * 60 * 60).catch(() => {});
            return result;
        } catch (error) {
            return fallback;
        }
    }
}

export const anilistService = new AnilistService();
