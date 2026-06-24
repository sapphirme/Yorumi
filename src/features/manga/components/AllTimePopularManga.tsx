import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mangaService } from '../../../services/mangaService';
import type { Manga } from '../../../types/manga';
import MangaCard from './MangaCard';

interface AllTimePopularMangaProps {
    onMangaClick: (mangaId: string, autoRead?: boolean, manga?: Manga) => void;

}

const AllTimePopularManga: React.FC<AllTimePopularMangaProps> = ({ onMangaClick }) => {
    const cachedPopular = mangaService.peekPopularManga(1);
    const [mangaList, setMangaList] = useState<Manga[]>(cachedPopular?.data || []);
    const [loading, setLoading] = useState(!(cachedPopular?.data?.length));
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'center',
        containScroll: 'trimSnaps',
        dragFree: true
    });

    useEffect(() => {
        const fetchManga = async () => {
            try {
                // Use getPopularManga for all-time popularity (POPULARITY_DESC)
                const { data } = await mangaService.getPopularManga(1);
                if (data) {
                    setMangaList(data);
                }
            } catch (err) {
                console.error('Failed to fetch all-time popular manga', err);
            } finally {
                setLoading(false);
            }
        };

        fetchManga();
    }, []);

    const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

    if (loading) {
        return (
            <section className="mb-12 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-8 w-56 rounded bg-white/10" />
                    <div className="h-6 w-20 rounded bg-white/10" />
                </div>
                <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="flex-[0_0_160px] md:flex-[0_0_210px] lg:flex-[0_0_230px]">
                            <div className="aspect-[2/3] rounded-lg bg-white/10 mb-3" />
                            <div className="h-4 w-4/5 rounded bg-white/10" />
                            <div className="h-4 w-3/5 rounded bg-white/10 mt-2" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }
    if (mangaList.length === 0) return null;

    return (
        <section className="mb-12">
            <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase leading-none whitespace-nowrap">All Time Popular</h2>
                <div className="flex-1 h-px bg-white/10" />

                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <button
                            onClick={scrollPrev}
                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-300" />
                        </button>
                        <button
                            onClick={scrollNext}
                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                            aria-label="Next"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-300" />
                        </button>
                    </div>


                </div>
            </div>

            <div className="relative">
                <div className="flex gap-4">
                    {/* Carousel Container */}
                    <div className="flex-1 overflow-hidden" ref={emblaRef}>
                        <div className="flex gap-4">
                            {mangaList.slice(0, 10).map((manga) => (
                                <div
                                    key={manga.id || manga.mal_id}
                                    className="flex-[0_0_160px] md:flex-[0_0_210px] lg:flex-[0_0_230px]"
                                >
                                    <MangaCard
                                        manga={manga as unknown as Manga}
                                        onClick={(mangaObj) => onMangaClick((mangaObj.id || mangaObj.mal_id).toString(), false, mangaObj)}
                                        disableTilt
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AllTimePopularManga;
