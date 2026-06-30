import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import VaultSpotlight from './components/VaultSpotlight';
import VaultLatestUpdates from './components/VaultLatestUpdates';
import SpotlightSkeleton from '../anime/components/SpotlightSkeleton';

import { API_BASE } from '../../config/api';
import AnimeDashboard from '../anime/components/AnimeDashboard';
import type { Anime } from '../../types/anime';

type VaultHomeKind = 'anime' | 'manga';
type VaultCacheEntry = { data: unknown; timestamp: number };
type VaultHomeResponse = {
    success?: boolean;
    data?: unknown;
    message?: string;
    cachedAt?: number;
};
type VaultAnimeVideo = {
    id?: number | string;
    slug?: string;
    scraperId?: string;
    title?: string;
    image?: string;
    poster?: string;
    year?: number;
    tags?: string[];
    views?: number;
    brand?: string;
    description?: string;
};
type VaultAnimeSection = {
    title: string;
    videos: VaultAnimeVideo[];
};

const vaultCache: Partial<Record<VaultHomeKind, VaultCacheEntry>> = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes frontend cache
const VAULT_CACHE_PREFIX = 'yorumi_vault_home_cache';

const isRecord = (value: unknown): value is Record<string, unknown> => (
    !!value && typeof value === 'object' && !Array.isArray(value)
);

const isUsableVaultHomeData = (kind: VaultHomeKind, data: unknown) => {
    if (kind === 'anime') {
        return Array.isArray(data)
            && data.some((section) => isRecord(section) && Array.isArray(section.videos) && section.videos.length > 0);
    }

    return isRecord(data)
        && ['spotlight', 'latest', 'newManhwa'].some((key) => Array.isArray(data[key]) && data[key].length > 0);
};

const getArrayField = (value: unknown, key: string) => {
    if (!isRecord(value) || !Array.isArray(value[key])) return [];
    return value[key];
};

const getScraperId = (value: unknown) => {
    if (!isRecord(value)) return '';
    return String(value.scraperId || '').trim();
};

const isVaultAnimeSection = (value: unknown): value is VaultAnimeSection => (
    isRecord(value)
    && typeof value.title === 'string'
    && Array.isArray(value.videos)
);

const getPersistedVaultCache = (kind: VaultHomeKind): VaultCacheEntry | null => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(`${VAULT_CACHE_PREFIX}:${kind}`);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<VaultCacheEntry>;
        if (!isUsableVaultHomeData(kind, parsed.data)) return null;

        return {
            data: parsed.data,
            timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : 0,
        };
    } catch {
        return null;
    }
};

const setPersistedVaultCache = (kind: VaultHomeKind, data: unknown, timestamp = Date.now()) => {
    if (!isUsableVaultHomeData(kind, data)) return;

    const entry = { data, timestamp };
    vaultCache[kind] = entry;

    try {
        window.localStorage.setItem(`${VAULT_CACHE_PREFIX}:${kind}`, JSON.stringify(entry));
    } catch (error) {
        console.warn(`[Vault] Failed to persist ${kind} home cache`, error);
    }
};

const getVaultCache = (kind: VaultHomeKind): VaultCacheEntry | null => {
    const memoryEntry = vaultCache[kind];
    if (memoryEntry && isUsableVaultHomeData(kind, memoryEntry.data)) return memoryEntry;

    const persistedEntry = getPersistedVaultCache(kind);
    if (persistedEntry) {
        vaultCache[kind] = persistedEntry;
    }
    return persistedEntry;
};

export default function VaultApp() {
    const location = useLocation();
    const navigate = useNavigate();
    const isManga = location.pathname.startsWith('/manga');
    const cacheKind: VaultHomeKind = isManga ? 'manga' : 'anime';
    const endpoint = isManga ? `${API_BASE}/vault/manga/home` : `${API_BASE}/vault/anime/home`;

    return (
        <VaultHomeView
            key={cacheKind}
            isManga={isManga}
            cacheKind={cacheKind}
            endpoint={endpoint}
            navigate={navigate}
        />
    );
}

interface VaultHomeViewProps {
    isManga: boolean;
    cacheKind: VaultHomeKind;
    endpoint: string;
    navigate: NavigateFunction;
}

function VaultHomeView({ isManga, cacheKind, endpoint, navigate }: VaultHomeViewProps) {
    
    // Initialize state with cache if available
    const cachedEntry = getVaultCache(cacheKind);

    const [data, setData] = useState<unknown>(cachedEntry ? cachedEntry.data : null);
    const [loading, setLoading] = useState(!cachedEntry);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        let isCancelled = false;
        const cached = getVaultCache(cacheKind);
        const hasCachedData = !!cached;
        const hasFreshCache = cached && (Date.now() - cached.timestamp < CACHE_TTL);

        if (hasFreshCache) {
            return; // Skip fetch if we have valid cached data
        }

        fetch(endpoint)
            .then(res => res.json().catch(() => ({ success: false, message: 'Invalid JSON response from server' })))
            .then(json => {
                if (isCancelled) return;
                const response = json as VaultHomeResponse;

                if (response.success && isUsableVaultHomeData(cacheKind, response.data)) {
                    setData(response.data);
                    setPersistedVaultCache(cacheKind, response.data, typeof response.cachedAt === 'number' ? response.cachedAt : Date.now());
                    setFetchError(null);
                } else if (hasCachedData) {
                    setFetchError(null);
                } else {
                    setFetchError(response.message || 'Server returned success: false');
                }
                setLoading(false);
            })
            .catch(err => {
                if (isCancelled) return;
                console.error(err);
                if (hasCachedData) {
                    setFetchError(null);
                } else {
                    setFetchError(err.message || 'Network fetch failed');
                }
                setLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [endpoint, cacheKind]);

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

    if (fetchError || !isUsableVaultHomeData(cacheKind, data)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-red-500 bg-[#050000]">
                <p className="font-semibold tracking-widest text-sm">FAILED TO FETCH DATA (NO CONTENT)</p>
                <p className="text-white/40 text-xs mt-2">Check backend server scraper selectors</p>
                {fetchError && <p className="text-red-400 text-xs mt-4 font-mono max-w-md text-center">{fetchError}</p>}
            </div>
        );
    }

    const handleMangaClick = (manga: unknown) => {
        const scraperId = getScraperId(manga);
        if (!scraperId) return;
        navigate(`/manga/details/${encodeURIComponent(scraperId)}`, { state: { manga } });
    };

    const handleAnimeClick = (anime: unknown) => {
        // Assume anime vault details page uses /anime/details/:id
        const scraperId = getScraperId(anime);
        if (!scraperId) return;
        navigate(`/anime/details/${encodeURIComponent(scraperId)}`, { state: { anime } });
    };

    if (isManga) {
        return (
            <div className="min-h-screen pb-20 bg-[#050000]">
                <VaultSpotlight items={getArrayField(data, 'spotlight')} onMangaClick={handleMangaClick} />
                <div className="w-full max-w-7xl mx-auto px-8 md:px-14 z-10 relative mt-8">

                    <VaultLatestUpdates items={getArrayField(data, 'newManhwa')} title="NEW MANHWA" onMangaClick={handleMangaClick} />
                    <VaultLatestUpdates items={getArrayField(data, 'latest')} title="LATEST RELEASES" onMangaClick={handleMangaClick} />
                </div>
            </div>
        );
    }

    const animeSections = Array.isArray(data) ? data.filter(isVaultAnimeSection) : [];
    const mapToAnimeList = (sectionTitle: string): Anime[] => {
        const section = animeSections.find((s) => s.title.toLowerCase().includes(sectionTitle.toLowerCase()));
        if (!section || !section.videos) return [];
        return section.videos.map((v) => ({
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
    animeSections.forEach((section) => {
        if (!usedSections.some(s => section.title.toLowerCase().includes(s))) {
            topAnime.push(...mapToAnimeList(section.title));
        }
    });

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
