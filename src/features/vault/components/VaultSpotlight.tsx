import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { AnimatePresence, m } from 'framer-motion';
import { API_BASE } from '../../../config/api';

interface VaultSpotlightProps {
    items: any[];
    onMangaClick?: (manga: any) => void;
}

// 3D Tilt Component for Spotlight Cover
const SpotlightCover: React.FC<{ thumbnail: string; title: string }> = ({ thumbnail, title }) => {
    const cardRef = React.useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = React.useState({ x: 0, y: 0 });
    const [glare, setGlare] = React.useState({ x: 50, y: 50, opacity: 0 });
    const [isHovered, setIsHovered] = React.useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;

        setRotation({ x: rotateX, y: rotateY });
        setGlare({
            x: (x / rect.width) * 100,
            y: (y / rect.height) * 100,
            opacity: 1
        });
    };

    const handleMouseLeave = () => {
        setRotation({ x: 0, y: 0 });
        setGlare(prev => ({ ...prev, opacity: 0 }));
        setIsHovered(false);
    };

    return (
        <div
            ref={cardRef}
            className={`hidden md:block w-56 lg:w-64 shrink-0 rounded-xl relative perspective-1000 transition-transform duration-500 ease-out ${isHovered ? 'rotate-0' : 'rotate-3'}`}
            style={{ perspective: '1000px' }}
            onMouseEnter={(e) => {
                setIsHovered(true);
                handleMouseMove(e);
            }}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
        >
            <div
                className="w-full h-full rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)] border border-white/10 transition-all duration-75 ease-out"
                style={{
                    transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`,
                    transformStyle: 'preserve-3d',
                }}
            >
                <div
                    className="absolute inset-0 z-30 pointer-events-none mix-blend-overlay transition-opacity duration-300"
                    style={{
                        background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.4) 0%, transparent 80%)`,
                        opacity: glare.opacity
                    }}
                />
                <img
                    src={thumbnail}
                    alt={title}
                    className="w-full h-auto object-cover"
                />
            </div>
        </div>
    );
};

export default function VaultSpotlight({ items, onMangaClick }: VaultSpotlightProps) {
    if (!items || items.length === 0) return null;

    const displayItems = items.slice(0, 10);

    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        duration: 20
    }, [
        Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })
    ]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [detailedData, setDetailedData] = useState<Record<string, any>>({});

    useEffect(() => {
        const activeItem = displayItems[selectedIndex];
        if (!activeItem || !activeItem.scraperId) return;

        if (!detailedData[activeItem.scraperId]) {
            const queryUrl = activeItem.url ? `?url=${encodeURIComponent(activeItem.url)}` : '';
            fetch(`${API_BASE}/vault/manga/details/${encodeURIComponent(activeItem.scraperId)}${queryUrl}`)
                .then(res => res.json())
                .then(json => {
                    if (json.success && json.data) {
                        setDetailedData(prev => ({ ...prev, [activeItem.scraperId]: json.data }));
                    }
                })
                .catch(() => {});
        }
    }, [selectedIndex, displayItems, detailedData]);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on('select', onSelect);
        return () => {
            emblaApi.off('select', onSelect);
        };
    }, [emblaApi, onSelect]);

    const scrollTo = useCallback((index: number) => {
        if (emblaApi) emblaApi.scrollTo(index);
    }, [emblaApi]);

    return (
        <div className="relative w-full h-[50vh] md:h-[60vh] min-h-[400px] md:min-h-[480px] group bg-[#0a0a0a] overflow-hidden mb-8">


            <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
                <div className="flex h-full touch-pan-y">
                    {displayItems.map((manga, index) => {
                        return (
                        <div key={manga.id || index} className="relative min-w-full h-full flex-[0_0_100%]">
                            <div className="absolute inset-0 z-0 select-none overflow-hidden">
                                <m.div
                                    initial={{ scale: 1.05, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 0.6 }}
                                    transition={{ duration: 0.8 }}
                                    className="absolute inset-0 bg-no-repeat bg-cover bg-center md:blur-lg md:scale-110"
                                    style={{
                                        backgroundImage: `url(${manga.image})`,
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/60 md:bg-black/40" />
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/60 to-[#0a0a0a]" />
                                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent pointer-events-none" />
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>

            <div className="absolute inset-0 flex items-center z-10 pointer-events-none">
                <AnimatePresence>
                    {displayItems[selectedIndex] && (() => {
                        const activeManga = displayItems[selectedIndex];
                        const fakeManga = {
                            mal_id: activeManga.id,
                            id: activeManga.id,
                            scraper_id: activeManga.scraperId,
                            title: activeManga.title,
                            images: { jpg: { large_image_url: activeManga.image, image_url: activeManga.image } },
                            chapters: activeManga.chapters?.[0]?.title ? parseInt(activeManga.chapters[0].title.replace(/\\D/g, '')) || undefined : undefined,
                            resolvedChapters: activeManga.chapters?.map((c: any) => ({ ...c, id: c.url })) || [],
                            type: 'Manga',
                            status: activeManga.status || 'Unknown',
                            score: 0,
                            genres: [],
                            countryOfOrigin: 'KR'
                        };
                        
                        const displayTitle = activeManga.title || 'Unknown Title';
                        const details = detailedData[activeManga.scraperId] || {};
                        const author = details.author || '';
                        const rating = parseFloat(details.rating) || activeManga.rating || 0;
                        const views = details.views || activeManga.views || '';
                        const synopsis = details.synopsis || activeManga.synopsis || '';
                        
                        return (
                            <m.div
                                key={selectedIndex}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4, ease: "easeInOut" }}
                                className="absolute inset-0 flex flex-col md:flex-row gap-12 items-center w-full max-w-7xl mx-auto px-8 md:px-14 mt-12"
                            >
                                <div className="flex-1 pointer-events-auto w-full max-w-2xl flex flex-col justify-end h-[360px] md:h-[380px]">
                                    <div className="w-full mb-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="md:hidden h-24 w-16 rounded-md overflow-hidden shadow-lg shadow-black/50 border border-white/10 flex-shrink-0 relative">
                                                <img
                                                    src={activeManga.image}
                                                    alt={displayTitle}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white drop-shadow-2xl">
                                                {displayTitle}
                                            </h1>
                                        </div>
                                    </div>

                                    <div className="w-full flex items-center flex-wrap gap-4 text-white select-none mb-4">
                                        {activeManga.chapters && activeManga.chapters.length > 0 && (
                                            <span className="flex items-center justify-center gap-1.5 bg-[#22c55e] text-white px-3 h-8 rounded-lg backdrop-blur-sm text-sm font-bold">
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v2H6V9h5v2zm7 0h-1.5v-.5h-2v3h2V13H18v2h-5V9h5v2z" /></svg>
                                                {activeManga.chapters[0].title}
                                            </span>
                                        )}
                                        {rating > 0 && (
                                            <span className="flex items-center justify-center gap-1 bg-[#1a1a1a] text-[#fbbf24] px-3 h-8 rounded-lg border border-[#fbbf24]/20 text-sm font-bold shadow-[0_0_10px_rgba(251,191,36,0.1)]">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                {rating.toFixed(1)}
                                            </span>
                                        )}
                                        {views && (
                                            <span className="flex items-center justify-center gap-1.5 bg-[#1a1a1a] text-[#a78bfa] px-3 h-8 rounded-lg border border-[#a78bfa]/20 text-sm font-bold">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                {views} views
                                            </span>
                                        )}
                                        {author && (
                                            <span className="flex items-center justify-center gap-1.5 bg-[#1a1a1a] text-[#94a3b8] px-3 h-8 rounded-lg border border-[#94a3b8]/20 text-sm font-bold">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                {author}
                                            </span>
                                        )}
                                    </div>

                                    <div className="w-full mb-6">
                                        <p className="text-gray-300 text-sm md:text-base line-clamp-3 max-w-xl leading-relaxed">
                                            {synopsis || "Loading synopsis..."}
                                        </p>
                                    </div>

                                    <div className="w-full flex gap-4">
                                        <button
                                            onClick={() => onMangaClick?.({ ...fakeManga, scraperId: activeManga.scraperId, autoRead: true })}
                                            className="bg-yorumi-manga text-white px-5 py-2.5 rounded-lg font-bold hover:bg-white hover:text-yorumi-bg transition-all duration-300 flex items-center gap-2 shadow-[0_0_15px_rgba(192,132,252,0.3)] hover:shadow-[0_0_25px_rgba(192,132,252,0.5)] text-sm md:text-base"
                                        >
                                            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            Read Now
                                        </button>
                                        <button
                                            onClick={() => onMangaClick?.({ ...fakeManga, scraperId: activeManga.scraperId })}
                                            className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-white/20 transition-all duration-300 flex items-center gap-2 text-sm md:text-base"
                                        >
                                            Detail <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="ml-auto lg:mr-12 xl:mr-20 pointer-events-none relative w-56 lg:w-64 h-[336px] lg:h-[384px] group">
                                    {displayItems.length > 1 && (
                                        <div 
                                            onClick={() => scrollTo((selectedIndex - 1 + displayItems.length) % displayItems.length)}
                                            className="absolute inset-0 hidden md:block pointer-events-auto cursor-pointer z-0"
                                        >
                                            <div 
                                                className="w-full h-full origin-bottom transition-transform duration-500 ease-out [transform:translateX(-40%)_translateY(-20px)_scale(0.9)_rotate(-8deg)] group-hover:[transform:translateX(-45%)_translateY(-20px)_scale(0.92)_rotate(-6deg)]"
                                            >
                                                <div className="w-full h-full rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-white/10 brightness-[0.6] transition-all duration-300">
                                                    <img src={displayItems[(selectedIndex - 1 + displayItems.length) % displayItems.length].image} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="absolute inset-0 z-10 pointer-events-auto transition-transform duration-500 ease-out group-hover:-translate-y-4">
                                        {activeManga.image && <SpotlightCover thumbnail={activeManga.image} title={displayTitle} />}
                                    </div>

                                    {displayItems.length > 2 && (
                                        <div 
                                            onClick={() => scrollTo((selectedIndex + 1) % displayItems.length)}
                                            className="absolute inset-0 hidden md:block pointer-events-auto cursor-pointer z-0"
                                        >
                                            <div 
                                                className="w-full h-full origin-bottom transition-transform duration-500 ease-out [transform:translateX(40%)_translateY(-20px)_scale(0.9)_rotate(8deg)] group-hover:[transform:translateX(45%)_translateY(-20px)_scale(0.92)_rotate(6deg)]"
                                            >
                                                <div className="w-full h-full rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-white/10 brightness-[0.6] transition-all duration-300">
                                                    <img src={displayItems[(selectedIndex + 1) % displayItems.length].image} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </m.div>
                        );
                    })()}
                </AnimatePresence>
            </div>

            <div className="absolute z-20 flex gap-2 right-4 top-1/2 -translate-y-1/2 flex-col md:flex-row md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:top-auto md:right-auto md:translate-y-0">
                {displayItems.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => scrollTo(idx)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === selectedIndex ? 'bg-[#52b9b7] md:w-6 h-6 md:h-2' : 'bg-white/30 hover:bg-white/50'
                            }`}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}
