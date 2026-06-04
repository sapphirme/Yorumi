import { animeService } from '../../services/animeService';
import { mangaService } from '../../services/mangaService';
import type { TitleLanguage } from '../../context/TitleLanguageContext';
import { getDisplayTitle, getSecondaryTitle } from '../../utils/titleLanguage';
import type { Anime } from '../../types/anime';
import type { Manga } from '../../types/manga';

export interface SearchPreviewItem {
    id: string | number;
    title: string;
    subtitle: string;
    image: string;
    date: string | number | undefined;
    type: string | undefined;
    duration: string | null;
    url: string;
}

type PreviewAnime = Anime & {
    year?: string | number;
    anilist_cover_image?: string;
};

type PreviewManga = Manga & {
    latestChapter?: string;
};

export const searchApi = {
    async getAnimePreview(query: string, language: TitleLanguage) {
        const { data } = await animeService.searchAnime(query, 1, 6);
        return (data as PreviewAnime[]).slice(0, 4).map((item) => ({
            id: item.id || item.mal_id,
            title: getDisplayTitle(item as unknown as Record<string, unknown>, language),
            subtitle: getSecondaryTitle(item as unknown as Record<string, unknown>, language),
            image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || item.anilist_cover_image || '',
            date: item.aired?.string ? item.aired.string : item.year,
            type: item.type,
            duration: item.duration || null,
            url: `/anime/details/${item.id || item.mal_id}`,
        })) as SearchPreviewItem[];
    },

    async getMangaPreview(query: string, language: TitleLanguage) {
        const { data } = await mangaService.searchMangaScraper(query, 1, 6);
        return (data as PreviewManga[]).slice(0, 4).map((item) => ({
            id: item.id || item.mal_id,
            title: getDisplayTitle(item as unknown as Record<string, unknown>, language),
            subtitle: item.latestChapter || getSecondaryTitle(item as unknown as Record<string, unknown>, language),
            image: item.images.jpg.image_url,
            date: item.published?.string
                ? new Date(item.published.string).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                })
                : '',
            type: item.type,
            duration: null,
            url: `/manga/details/${item.id || item.mal_id}`,
        })) as SearchPreviewItem[];
    },
};
