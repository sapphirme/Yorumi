import React from 'react';
import type { Anime } from '../../../types/anime';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import AnimeCardSkeleton from './AnimeCardSkeleton';
import AnimeCard from './AnimeCard';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';
import { getDisplayImageUrl } from '../../../utils/image';

interface TrendingNowProps {
    animeList: Anime[];
    title?: string;
    isLoading?: boolean;
    onAnimeClick: (anime: Anime) => void;
    onWatchClick?: (anime: Anime) => void;

    onMouseEnter?: (anime: Anime) => void;
    variant?: 'portrait' | 'landscape';
}

const TrendingNow: React.FC<TrendingNowProps> = ({
    animeList,
    title = 'Trending',
    isLoading = false,
    onAnimeClick,
    onWatchClick,

    onMouseEnter,
    variant = 'portrait'
}) => {
    const { language } = useTitleLanguage();
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'center',
        containScroll: 'trimSnaps',
        dragFree: true
    });

    const scrollPrev = () => emblaApi && emblaApi.scrollPrev();
    const scrollNext = () => emblaApi && emblaApi.scrollNext();

    if (isLoading) {
        return (
            <section className="relative z-20 mt-4 mb-12">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-7 w-36 bg-white/10 rounded animate-pulse" />
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                            <div className="h-8 w-8 rounded-full bg-white/5 border border-white/5 animate-pulse" />
                            <div className="h-8 w-8 rounded-full bg-white/5 border border-white/5 animate-pulse" />
                        </div>
                        <div className="h-4 w-14 bg-white/10 rounded animate-pulse" />
                    </div>
                </div>

                <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div
                            key={`trending-skeleton-${index}`}
                            className={variant === 'landscape'
                                ? 'flex-none w-[240px] sm:w-[280px] md:w-[320px]'
                                : 'flex-[0_0_140px] md:flex-[0_0_180px] lg:flex-[0_0_200px]'}
                        >
                            {variant === 'landscape' ? (
                                <>
                                    <div className="aspect-video rounded-lg bg-white/10 animate-pulse mb-3" />
                                    <div className="h-4 w-4/5 rounded bg-white/10 animate-pulse" />
                                </>
                            ) : (
                                <AnimeCardSkeleton />
                            )}
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (!animeList || animeList.length === 0) return null;

    return (
        <section className="relative z-20 mt-4 mb-12">
            <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase whitespace-nowrap">{title}</h2>
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
                            {animeList.map((anime) => {
                                const displayTitle = getDisplayTitle(anime as unknown as Record<string, unknown>, language);
                                const landscapeImage = getDisplayImageUrl(
                                    anime.episodeMetadata?.[0]?.thumbnail ||
                                    anime.anilist_banner_image ||
                                    anime.images.jpg.large_image_url ||
                                    anime.images.jpg.image_url
                                );
                                const episodeCount = anime.latestEpisode || anime.episodes;

                                return (
                                <div
                                    key={`${anime.scraperId || anime.id || anime.mal_id || anime.title}-${anime.latestEpisode || anime.episodes || 0}`}
                                    className={variant === 'landscape'
                                        ? 'flex-none w-[240px] sm:w-[280px] md:w-[320px]'
                                        : 'flex-[0_0_140px] md:flex-[0_0_180px] lg:flex-[0_0_200px]'}
                                >
                                    {variant === 'landscape' ? (
                                        <div
                                            className="relative group cursor-pointer transition-transform duration-300 hover:-translate-y-1"
                                            onClick={() => onWatchClick?.(anime) || onAnimeClick(anime)}
                                            onMouseEnter={() => onMouseEnter?.(anime)}
                                        >
                                            <div className="relative aspect-video rounded-lg overflow-hidden mb-3 shadow-lg border border-white/5 bg-white/5">
                                                <img
                                                    src={landscapeImage}
                                                    alt={displayTitle}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white ml-1">
                                                            <path fillRule="evenodd" d="M4.5 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                {episodeCount && (
                                                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10">
                                                        EP {episodeCount}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="px-1">
                                                <h3 className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-gray-200 group-hover:text-yorumi-accent transition-colors">
                                                    {displayTitle}
                                                </h3>
                                            </div>
                                        </div>
                                    ) : (
                                        <AnimeCard
                                            anime={anime}
                                            onClick={() => onAnimeClick(anime)}
                                            onWatchClick={() => onWatchClick?.(anime)}
                                            onMouseEnter={() => onMouseEnter?.(anime)}
                                            disableTilt
                                        />
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Navigation Buttons - Removed from side */}
                </div>
            </div>
        </section>
    );
};

export default TrendingNow;
