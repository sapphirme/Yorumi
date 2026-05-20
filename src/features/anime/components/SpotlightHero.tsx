import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { Anime } from '../../../types/anime';
import AnimeLogoImage from '../../../components/anime/AnimeLogoImage';
import SpotlightSkeleton from './SpotlightSkeleton';
import { useTitleLanguage } from '../../../context/TitleLanguageContext';
import { getDisplayTitle } from '../../../utils/titleLanguage';

interface SpotlightHeroProps {
    animeList: Anime[];
    isLoading?: boolean;
    onAnimeClick: (anime: Anime) => void;
    onWatchClick: (anime: Anime) => void;
    onAnimeHover?: (anime: Anime) => void;
}



const SpotlightHero: React.FC<SpotlightHeroProps> = ({ animeList, isLoading = false, onAnimeClick, onWatchClick, onAnimeHover }) => {
    const { language } = useTitleLanguage();
    // Embla Carousel hook
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        duration: 20
    });
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showTrailer, setShowTrailer] = useState(false);
    const [revealTrailer, setRevealTrailer] = useState(false);

    // Update selected index when slide changes
    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    // Attach event listener
    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on('select', onSelect);
        return () => {
            emblaApi.off('select', onSelect);
        };
    }, [emblaApi, onSelect]);

    useEffect(() => {
        const activeAnime = animeList[selectedIndex];
        if (activeAnime) {
            onAnimeHover?.(activeAnime);
        }
    }, [animeList, onAnimeHover, selectedIndex]);

    useEffect(() => {
        setShowTrailer(false);
        setRevealTrailer(false);
        const activeAnime = animeList[selectedIndex];
        const hasTrailer = Boolean(activeAnime?.trailer?.id && activeAnime?.trailer?.site);
        if (!hasTrailer) return;

        const showTimer = window.setTimeout(() => {
            setShowTrailer(true);
        }, 500);
        const revealTimer = window.setTimeout(() => {
            setRevealTrailer(true);
        }, 500);

        return () => {
            window.clearTimeout(showTimer);
            window.clearTimeout(revealTimer);
        };
    }, [animeList, selectedIndex]);

    const handleNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext();
    }, [emblaApi]);

    const handlePrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev();
    }, [emblaApi]);

    const scrollTo = useCallback((index: number) => {
        if (emblaApi) emblaApi.scrollTo(index);
    }, [emblaApi]);

    // Keep the hero's space reserved until spotlight data is available.
    if (isLoading || animeList.length === 0) {
        return <SpotlightSkeleton />;
    }

    return (
        <div
            className="relative w-full h-[62vh] md:h-[88vh] min-h-[520px] md:min-h-[680px] group bg-yorumi-bg overflow-hidden"
        >
            {/* Embla Viewport */}
            <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
                <div className="flex h-full touch-pan-y">
                    {animeList.map((anime, index) => {
                        const landscapeImage = anime.anilist_banner_image || anime.images.jpg.large_image_url;
                        const trailerSite = anime.trailer?.site?.toLowerCase();
                        const trailerId = anime.trailer?.id;
                        const isActive = index === selectedIndex;
                        const trailerUrl = trailerId && trailerSite
                            ? (trailerSite === 'youtube'
                                ? `https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerId}&modestbranding=1&playsinline=1&rel=0&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0&vq=hd1080&hd=1&origin=${encodeURIComponent(window.location.origin)}`
                                : trailerSite === 'dailymotion'
                                    ? `https://www.dailymotion.com/embed/video/${trailerId}?autoplay=1&mute=1&loop=1&controls=0`
                                    : null)
                            : null;
                        const directDistance = Math.abs(index - selectedIndex);
                        const loopDistance = Math.min(directDistance, animeList.length - directDistance);
                        const shouldLoadBackdrop = loopDistance <= 1;
                        const shouldCoverTrailer = Boolean(trailerUrl && isActive && showTrailer && !revealTrailer);
                        const shouldFadeBackdrop = Boolean(trailerUrl && isActive && revealTrailer);

                        return (
                            <div
                                key={`${anime.scraperId || anime.id || anime.mal_id || anime.title}-${index}`}
                                className="relative min-w-full h-full flex-[0_0_100%]"
                            >
                                {/* Background Image */}
                                <div className="absolute inset-0 z-0 select-none">
                                    {trailerUrl && isActive && (
                                        <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-300 ${showTrailer ? 'opacity-100' : 'opacity-0'}`}>
                                            {showTrailer && (
                                                <iframe
                                                    className="absolute inset-0 h-full w-full scale-125"
                                                    src={trailerUrl}
                                                    title={`${getDisplayTitle(anime as unknown as Record<string, unknown>, language)} trailer`}
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                    allowFullScreen={false}
                                                    referrerPolicy="strict-origin-when-cross-origin"
                                                />
                                            )}
                                        </div>
                                    )}
                                    <div
                                        className={`absolute inset-0 z-10 bg-no-repeat bg-cover bg-center transition-opacity duration-1000 ${shouldFadeBackdrop ? 'opacity-0' : shouldCoverTrailer ? 'opacity-100' : 'opacity-90'}`}
                                        style={{
                                            backgroundImage: shouldLoadBackdrop ? `url(${landscapeImage})` : 'none',
                                        }}
                                    />
                                    {/* Overlay */}
                                    <div className="absolute inset-0 z-20 bg-black/40 pointer-events-none" />
                                    <div className="absolute inset-0 z-20 bg-gradient-to-r from-[#050505] via-[#050505]/70 to-[#050505]/15 pointer-events-none" />
                                    <div className="absolute inset-0 z-20 bg-gradient-to-t from-[#050505] via-[#050505]/25 to-transparent pointer-events-none" />
                                </div>

                                {/* Content */}
                                <div className="absolute inset-0 flex items-end px-4 pb-14 md:px-16 md:pb-24 z-10 pointer-events-none">
                                    <div className="flex w-full max-w-7xl mx-auto">

                                        {/* Left Column: Text Info */}
                                        <div className="flex-1 pointer-events-auto max-w-2xl w-full min-w-0">
                                            {/* Logo */}
                                            <div className={`${getDisplayTitle(anime as unknown as Record<string, unknown>, language).length > 50 ? 'max-h-14 md:max-h-44' :
                                                getDisplayTitle(anime as unknown as Record<string, unknown>, language).length > 30 ? 'max-h-16 md:max-h-48' :
                                                    'max-h-20 md:max-h-56'
                                                } mb-8 md:mb-12 flex items-start overflow-visible max-w-[92%] md:max-w-none`}>
                                                <AnimeLogoImage
                                                    anilistId={anime.id || anime.mal_id}
                                                    title={getDisplayTitle(anime as unknown as Record<string, unknown>, language)}
                                                    year={anime.year}
                                                    episodes={anime.latestEpisode || anime.episodes}
                                                    format={anime.type}
                                                    className="drop-shadow-2xl max-h-full origin-left object-contain text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
                                                    size="large"
                                                    style={{ maxHeight: 'inherit' }}
                                                />
                                            </div>

                                            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-xs md:text-sm text-white mb-4 md:mb-6 font-medium select-none">
                                                <div className="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-full border border-white/5 backdrop-blur-sm">
                                                    <span className="flex items-center gap-1.5">
                                                        <svg className="w-4 h-4 text-yorumi-accent" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                        {anime.type || 'TV'}
                                                    </span>
                                                    <span className="w-px h-3 bg-white/20"></span>
                                                    <span className="flex items-center gap-1.5">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        {anime.duration?.replace(' per ep', '').replace('min', ' min') || '24 min'}
                                                    </span>
                                                    <span className="w-px h-3 bg-white/20"></span>
                                                    <span className="flex items-center gap-1.5">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        {anime.aired?.string?.split(',')[1]?.trim() || anime.year || '2025'}
                                                    </span>
                                                </div>

                                                <div className="flex gap-2 ml-1 items-center">
                                                    <span className="bg-yorumi-accent text-yorumi-bg px-2.5 py-1 rounded text-xs font-bold">HD</span>
                                                    {(anime.latestEpisode || anime.episodes) && (
                                                        <span className="bg-[#22c55e] text-white px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v2H6V9h5v2zm7 0h-1.5v-.5h-2v3h2V13H18v2h-5V9h5v2z" /></svg>
                                                            {anime.latestEpisode || anime.episodes}
                                                        </span>
                                                    )}
                                                    {anime.score > 0 && (
                                                        <span className="bg-[#facc15] text-black px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                                            {anime.score.toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="text-gray-300 mb-6 md:mb-10 line-clamp-3 text-sm md:text-base leading-relaxed max-w-xl pr-0 md:pr-4 select-none">
                                                {anime.synopsis || "No synopsis available."}
                                            </p>

                                            <div className="flex gap-4 pointer-events-auto z-20">
                                                <button
                                                    onMouseEnter={() => onAnimeHover?.(anime)}
                                                    onFocus={() => onAnimeHover?.(anime)}
                                                    onClick={() => onWatchClick(anime)}
                                                    className="bg-yorumi-accent text-yorumi-bg px-6 md:px-8 py-3 md:py-3.5 rounded-full font-bold hover:bg-white transition-all duration-300 transform hover:scale-105 flex items-center gap-3 shadow-[0_0_20px_rgba(61,180,242,0.3)] hover:shadow-[0_0_30px_rgba(61,180,242,0.6)] text-sm md:text-base"
                                                >
                                                    <div className="bg-yorumi-bg text-white rounded-full p-1.5 -ml-2">
                                                        <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                    </div>
                                                    Watch Now
                                                </button>
                                                <button
                                                    onMouseEnter={() => onAnimeHover?.(anime)}
                                                    onFocus={() => onAnimeHover?.(anime)}
                                                    onClick={() => onAnimeClick(anime)}
                                                    className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-full font-bold hover:bg-white/20 transition-all duration-300 flex items-center gap-2 text-sm md:text-base"
                                                >
                                                    Detail <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                </button>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Navigation Buttons */}
            <div className="absolute z-20 flex gap-3 right-4 md:right-8 bottom-16 md:bottom-8">
                <button
                    onClick={handlePrev}
                    className="p-3 bg-black/55 hover:bg-yorumi-accent hover:text-yorumi-bg text-white rounded-md border border-white/10 transition-all backdrop-blur-md"
                    aria-label="Previous Slide"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                    onClick={handleNext}
                    className="p-3 bg-black/55 hover:bg-yorumi-accent hover:text-yorumi-bg text-white rounded-md border border-white/10 transition-all backdrop-blur-md"
                    aria-label="Next Slide"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* Dots Indicator */}
            <div className="absolute z-20 flex gap-2 left-1/2 -translate-x-1/2 bottom-6">
                {animeList.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => scrollTo(idx)}
                        className={`h-2 rounded-full transition-all duration-300 ${idx === selectedIndex ? 'w-7 bg-yorumi-accent' : 'w-2 bg-white/30 hover:bg-white/50'
                            }`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default SpotlightHero;
