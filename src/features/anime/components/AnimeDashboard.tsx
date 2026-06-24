
import type { Anime } from '../../../types/anime';
import SpotlightHero from './SpotlightHero';
import TrendingNow from './TrendingNow';
import PopularSeason from './PopularSeason';
import AnimeCard from './AnimeCard';
import AnimeCardSkeleton from './AnimeCardSkeleton';

import TopTenSidebar from './TopTenSidebar';

interface AnimeDashboardProps {
    spotlightAnime: Anime[];
    spotlightLoading?: boolean;
    latestUpdates: Anime[];
    latestUpdatesLoading: boolean;
    trendingAnime: Anime[];
    trendingLoading: boolean;
    popularSeason: Anime[];
    popularSeasonLoading: boolean;
    topTenToday: Anime[];
    topTenWeek: Anime[];
    topTenMonth: Anime[];
    topTenLoading: boolean;
    topAnime: Anime[];
    topAnimeLoading?: boolean;
    allTimeTitle?: string;
    compactCatalogMode?: boolean;


    onAnimeClick: (anime: Anime) => void;
    onWatchClick: (anime: Anime, episodeNumber?: number, startSeconds?: number) => void;
    onAnimeHover?: (anime: Anime) => void;
}

export default function AnimeDashboard({
    spotlightAnime,
    spotlightLoading = false,
    latestUpdates,
    latestUpdatesLoading,
    trendingAnime,
    trendingLoading,
    popularSeason,
    popularSeasonLoading,
    topTenToday,
    topTenWeek,
    topTenMonth,
    topTenLoading,
    topAnime,
    topAnimeLoading = false,
    allTimeTitle = 'All-Time Popular',
    compactCatalogMode = false,


    onAnimeClick,
    onWatchClick,
    onAnimeHover
}: AnimeDashboardProps) {


    return (
        <>
            {!compactCatalogMode && (
                <SpotlightHero
                    animeList={spotlightAnime}
                    isLoading={spotlightLoading}
                    onAnimeClick={onAnimeClick}
                    onWatchClick={onWatchClick}
                    onAnimeHover={onAnimeHover}
                />
            )}

            <div className={`w-full max-w-7xl mx-auto px-8 md:px-14 z-10 relative ${compactCatalogMode ? '' : 'mt-8'}`}>

                {!compactCatalogMode && (
                    <TrendingNow
                        animeList={latestUpdates}
                        title="Latest Updates"
                        isLoading={latestUpdatesLoading}
                        onAnimeClick={onAnimeClick}
                        onWatchClick={(anime) => onWatchClick(anime, 1)}

                        onMouseEnter={onAnimeHover}
                    />
                )}

                {!compactCatalogMode && (
                    <TrendingNow
                        animeList={trendingAnime}
                        isLoading={trendingLoading}
                        onAnimeClick={onAnimeClick}
                        onWatchClick={(anime) => onWatchClick(anime, 1)}

                        onMouseEnter={onAnimeHover}
                    />
                )}

                {!compactCatalogMode && (
                    <PopularSeason
                        animeList={popularSeason}
                        isLoading={popularSeasonLoading}
                        onAnimeClick={onAnimeClick}
                        onWatchClick={(anime) => onWatchClick(anime, 1)}

                        onMouseEnter={onAnimeHover}
                    />
                )}

                {/* All-Time Popular + Top 10 + Schedule + Genres */}
                <div className="w-full pt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
                        <div data-hover-boundary>
                            <div className="flex items-center gap-4 mb-6">
                                <h2 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase whitespace-nowrap">{allTimeTitle}</h2>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-4 md:gap-6">
                                {topAnimeLoading ? (
                                    Array.from({ length: 15 }).map((_, i) => (
                                        <div key={i} className={i >= 10 ? 'hidden sm:block' : ''}>
                                            <AnimeCardSkeleton />
                                        </div>
                                    ))
                                ) : (
                                    topAnime.slice(0, 15).map((item, i) => (
                                        <div
                                            key={`${item.scraperId || item.id || item.mal_id || item.title}-${item.latestEpisode || item.episodes || 0}`}
                                            className={i >= 10 ? 'hidden sm:block' : ''}
                                        >
                                            <AnimeCard
                                                anime={item}
                                                onClick={() => onAnimeClick(item)}
                                                onWatchClick={() => onWatchClick(item, 1)}
                                                onMouseEnter={() => onAnimeHover?.(item)}
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <TopTenSidebar
                                today={topTenToday}
                                week={topTenWeek}
                                month={topTenMonth}
                                isLoading={topTenLoading}
                                onAnimeClick={onAnimeClick}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
