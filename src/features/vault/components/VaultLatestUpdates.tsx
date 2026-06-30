import React from 'react';
import MangaCard from '../../manga/components/MangaCard';
import type { Manga } from '../../../types/manga';

import MangaCardSkeleton from '../../manga/components/MangaCardSkeleton';

interface VaultLatestUpdatesProps {
    items: any[];
    onMangaClick?: (manga: any) => void;
    loading?: boolean;
    title?: string;
}

export default function VaultLatestUpdates({ items, onMangaClick, loading, title = 'LATEST RELEASES' }: VaultLatestUpdatesProps) {
    if (!loading && (!items || items.length === 0)) return null;

    return (
        <section className="mb-12">
            <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase leading-none whitespace-nowrap">
                    {title}
                </h2>
                <div className="flex-1 h-px bg-white/10" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
                {loading ? (
                    Array.from({ length: 20 }).map((_, index) => (
                        <MangaCardSkeleton key={index} />
                    ))
                ) : (
                    items.map((manga, index) => {
                        const fakeManga = {
                            mal_id: manga.id,
                            id: manga.id,
                            scraper_id: manga.scraperId,
                            title: manga.title,
                            title_english: manga.title,
                            images: { jpg: { large_image_url: manga.image, image_url: manga.image } },
                            chapters: manga.chapters?.[0]?.title ? parseInt(manga.chapters[0].title.replace(/\D/g, '')) || undefined : undefined,
                            resolvedChapters: manga.chapters?.map((c: any) => ({ ...c, id: c.url })) || [],
                            type: 'Manga',
                            status: manga.status || 'Unknown',
                            score: parseFloat(manga.rating) || 0,
                            views: manga.views,
                            authors: manga.author ? [{ name: manga.author, mal_id: 0 }] : undefined,
                            genres: [],
                            countryOfOrigin: 'KR'
                        } as unknown as Manga;
                        
                        return (
                            <MangaCard 
                                key={manga.id || index}
                                manga={fakeManga}
                                onClick={(mangaObj) => onMangaClick?.({ ...mangaObj, scraperId: manga.scraperId })}
                                disableTilt
                            />
                        );
                    })
                )}
            </div>
        </section>
    );
}
