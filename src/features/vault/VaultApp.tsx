import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VaultSpotlight from './components/VaultSpotlight';
import VaultLatestUpdates from './components/VaultLatestUpdates';
import { Eye } from 'lucide-react';
import SpotlightSkeleton from '../anime/components/SpotlightSkeleton';

import { API_BASE } from '../../config/api';
import AnimeDashboard from '../anime/components/AnimeDashboard';
import type { Anime } from '../../types/anime';
import { useContinueWatching } from '../../hooks/useContinueWatching';
import { useContinueReading } from '../../hooks/useContinueReading';
import MangaContinueReading from '../manga/components/MangaContinueReading';

const vaultCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes frontend cache

export default function VaultApp() {
    const location = useLocation();
    const navigate = useNavigate();
    const isManga = location.pathname.startsWith('/manga');
    const { continueWatchingList, removeFromHistory: removeWatchingHistory } = useContinueWatching({ isVault: true });
    const { continueReadingList, removeFromHistory: removeReadingHistory } = useContinueReading({ isVault: true });
    
    const endpoint = isManga ? `${API_BASE}/vault/manga/home` : `${API_BASE}/vault/anime/home`;
    
    // Initialize state with cache if available
    const cachedEntry = vaultCache[endpoint];
    const isCachedValid = cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL);

    const [data, setData] = useState<any>(isCachedValid ? cachedEntry.data : null);
    const [loading, setLoading] = useState(!isCachedValid);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        if (isCachedValid && data) {
            return; // Skip fetch if we have valid cached data
        }

        setLoading(true);
        fetch(endpoint)
            .then(res => res.json().catch(() => ({ success: false, message: 'Invalid JSON response from server' })))
            .then(json => {
                if (json.success) {
                    setData(json.data);
                    vaultCache[endpoint] = { data: json.data, timestamp: Date.now() };
                } else {
                    setFetchError(json.message || 'Server returned success: false');
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setFetchError(err.message || 'Network fetch failed');
                setLoading(false);
            });
    }, [endpoint, isCachedValid, data]);

    if (loading) {
        if (isManga) {
            return (
                <div className="min-h-screen pb-20 bg-[#050000]">
                    <SpotlightSkeleton />
                    <div className="w-full max-w-7xl mx-auto px-8 md:px-14 z-10 relative mt-8">
                        <VaultLatestUpdates items={[]} loading={true} title="NEW MANHWA" />
                        <VaultLatestUpdates items={[]} loading={true} title="LATEST RELEASES" />
                    </div>
                </div>
            );
        }
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-red-500 bg-[#050000]">
                <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (fetchError || !data || (isManga && !data.spotlight?.length && !data.latest?.length && !data.newManhwa?.length) || (!isManga && data.length === 0)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-red-500 bg-[#050000]">
                <p className="font-semibold tracking-widest text-sm">FAILED TO FETCH DATA (NO CONTENT)</p>
                <p className="text-white/40 text-xs mt-2">Check backend server scraper selectors</p>
                {fetchError && <p className="text-red-400 text-xs mt-4 font-mono max-w-md text-center">{fetchError}</p>}
            </div>
        );
    }

    const handleMangaClick = (manga: any) => {
        navigate(`/manga/details/${encodeURIComponent(manga.scraperId)}`, { state: { manga } });
    };

    const handleAnimeClick = (anime: any) => {
        // Assume anime vault details page uses /anime/details/:id
        navigate(`/anime/details/${encodeURIComponent(anime.scraperId)}`, { state: { anime } });
    };

    if (isManga) {
        return (
            <div className="min-h-screen pb-20 bg-[#050000]">
                <VaultSpotlight items={data.spotlight || []} onMangaClick={handleMangaClick} />
                <div className="w-full max-w-7xl mx-auto px-8 md:px-14 z-10 relative mt-8">

                    <VaultLatestUpdates items={data.newManhwa || []} title="NEW MANHWA" onMangaClick={handleMangaClick} />
                    <VaultLatestUpdates items={data.latest || []} title="LATEST RELEASES" onMangaClick={handleMangaClick} />
                </div>
            </div>
        );
    }

    const mapToAnimeList = (sectionTitle: string): Anime[] => {
        const section = data.find((s: any) => s.title.toLowerCase().includes(sectionTitle.toLowerCase()));
        if (!section || !section.videos) return [];
        return section.videos.map((v: any) => ({
            id: v.id,
            mal_id: v.id,
            scraperId: v.scraperId || `vault-anime:hanime:${v.slug}`,
            title: v.title,
            title_english: v.title,
            images: {
                jpg: {
                    image_url: v.image,
                    large_image_url: v.image
                }
            },
            anilist_banner_image: v.poster || v.image,
            year: v.year,
            type: 'OVA',
            status: 'FINISHED',
            episodes: 1,
            genres: (v.tags || []).map((t: string) => ({ name: t, mal_id: t })),
            score: v.views ? Math.min(9.9, parseFloat((v.views / 100000 + 5.0).toFixed(1))) : undefined,
            views: v.views,
            rating: v.brand,
            synopsis: v.description ? v.description.replace(/<\/?[^>]+(>|$)/g, "") : '',
        } as unknown as Anime));
    };

    const spotlightAnime = mapToAnimeList('recent uploads');
    const latestUpdates = mapToAnimeList('new releases');
    const trendingAnime = mapToAnimeList('trending');
    const popularSeason = mapToAnimeList('random');

    // Get any remaining sections for topAnime
    const topAnime: Anime[] = [];
    const usedSections = ['recent uploads', 'new releases', 'trending', 'random'];
    if (!isManga && Array.isArray(data)) {
        data.forEach((section: any) => {
            if (!usedSections.some(s => section.title.toLowerCase().includes(s))) {
                topAnime.push(...mapToAnimeList(section.title));
            }
        });
    }

    // Fallback if spotlight is empty
    const finalSpotlight = (spotlightAnime.length > 0 ? spotlightAnime : topAnime).slice(0, 8);

    // Anime (Hanime) Layout
    return (
        <div className="min-h-screen pb-20 bg-[#0a0a0a]">
            <AnimeDashboard
                continueWatchingList={[]}
                onRemoveHistory={() => {}}
                hideTopTen={true}
                hideTopAnime={true}
                spotlightAnime={finalSpotlight}
                spotlightLoading={false}
                latestUpdates={latestUpdates}
                latestUpdatesLoading={false}
                trendingAnime={trendingAnime}
                trendingLoading={false}
                popularSeason={popularSeason}
                popularSeasonLoading={false}
                topTenToday={[]}
                topTenWeek={[]}
                topTenMonth={[]}
                topTenLoading={false}
                topAnime={topAnime}
                topAnimeLoading={false}
                allTimeTitle="More Videos"
                latestUpdatesTitle="New Releases"
                trendingTitle="Trending"
                popularSeasonTitle="Random"
                onAnimeClick={handleAnimeClick}
                onWatchClick={(anime) => handleAnimeClick(anime)}
            />
        </div>
    );
}

