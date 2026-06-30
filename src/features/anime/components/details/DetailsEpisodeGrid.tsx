import { memo, useState } from 'react';
import { CircleCheckBig } from 'lucide-react';
import type { Episode, Anime } from '../../../../types/anime';
import { getEpisodeWatchKey } from '../../../../utils/episodeWatchKey';

export type NormalizedEpisode = Episode & {
    title: string;
    overview?: string;
    thumbnail?: string;
    airDate?: string | null;
    tmdbSeason?: number;
    tmdbEpisode?: number;
    playbackEpisodeNumber?: number;
};

export interface SeasonChip {
    id: number;
    label: string;
    title: string;
    isActive: boolean;
    source?: 'anilist' | 'tmdb';
    tmdbSeasonNumber?: number;
    offset?: number;
    count?: number;
    anime?: Anime;
    anilistId?: number;
    isVirtual?: boolean;
}

function EpisodeThumbnail({ src, label }: { src?: string; label: string }) {
    const [failed, setFailed] = useState(false);

    if (!src || failed) {
        return (
            <div className="w-full h-full flex items-center justify-center text-gray-700 font-bold text-lg">
                {label}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
}

interface DetailsEpisodeGridProps {
    episodes: NormalizedEpisode[];
    watchedEpisodes: Set<string>;
    activeEpParam: string | null;
    seasonChips?: SeasonChip[];
    isLoading?: boolean;
    skeletonCount?: number;
    fallbackCoverImage?: string;
    onSeasonClick?: (season: SeasonChip) => void;
    onEpisodeClick: (ep: NormalizedEpisode) => void;
}

type EpisodeCardProps = {
    episode: NormalizedEpisode;
    isWatched: boolean;
    isActive: boolean;
    fallbackCoverImage?: string;
    onEpisodeClick: (ep: NormalizedEpisode) => void;
};

const EpisodeCard = memo(function EpisodeCard({ episode, isWatched, isActive, fallbackCoverImage, onEpisodeClick }: EpisodeCardProps) {
    const cleanTitle = episode.title ? episode.title.split('<note-split>')[0].trim() : '';
    const displayTitle = cleanTitle || `Episode ${episode.episodeNumber}`;
    const isUnreleased = Boolean(episode.airDate && new Date(episode.airDate).getTime() > Date.now());
    const thumbnail = isUnreleased ? fallbackCoverImage : (episode.thumbnail || episode.snapshot);

    return (
        <button
            key={episode.session || episode.episodeNumber}
            onClick={() => {
                if (!isUnreleased) onEpisodeClick(episode);
            }}
            className={`flex items-stretch text-left bg-[#141414] rounded-lg overflow-hidden transition-all duration-200 group h-[104px]
                ${isActive ? 'ring-1 ring-blue-400 bg-[#1a1a1a]' : isWatched ? 'ring-1 ring-green-500/30 bg-green-500/5 hover:bg-green-500/10' : 'hover:bg-[#1a1a1a]'}
                ${isUnreleased ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] cursor-pointer'}`}
            title={displayTitle}
        >
            <div className="w-28 sm:w-32 aspect-video shrink-0 relative bg-[#0a0a0a]">
                <EpisodeThumbnail src={thumbnail} label={`E${episode.episodeNumber}`} />
                {isActive ? (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                        <div className="flex items-center gap-1.5 text-white font-bold text-xs tracking-wider">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            PLAYING
                        </div>
                    </div>
                ) : isUnreleased ? (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-1 text-gray-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                )}
            </div>
            <div className="flex-1 p-3 flex flex-col justify-start min-w-0">
                <div className="flex justify-between items-center w-full">
                    <span className={`font-black text-xs uppercase tracking-wider ${isWatched ? 'text-green-500' : 'text-blue-300'}`}>E{episode.episodeNumber}</span>
                    {isWatched && (
                        <CircleCheckBig className="w-4 h-4 text-green-500 shrink-0" />
                    )}
                </div>
                <span className={`font-semibold text-sm line-clamp-2 mt-0.5 leading-snug min-h-[2.5rem] ${isWatched ? 'text-green-50' : 'text-white'}`}>{isUnreleased ? 'Unreleased' : displayTitle}</span>
            </div>
        </button>
    );
});

const EpisodeCardSkeleton = () => (
    <div className="flex items-stretch bg-[#141414] rounded-lg overflow-hidden animate-pulse h-[104px]">
        <div className="w-28 sm:w-32 shrink-0 bg-white/10" />
        <div className="flex-1 p-3 flex flex-col justify-start min-w-0">
            <div className="flex justify-between items-center w-full mb-1.5">
                <div className="h-3 w-10 bg-white/20 rounded" />
            </div>
            <div className="space-y-1.5">
                <div className="h-3.5 w-[90%] bg-white/10 rounded" />
                <div className="h-3.5 w-[60%] bg-white/10 rounded" />
            </div>
        </div>
    </div>
);

export default function DetailsEpisodeGrid({ episodes, watchedEpisodes, activeEpParam, seasonChips = [], isLoading = false, skeletonCount = 12, fallbackCoverImage, onSeasonClick, onEpisodeClick }: DetailsEpisodeGridProps) {

    return (
        <div className="pt-2">
            <div className="flex items-center gap-4 mb-6">
                <h3 className="text-xl font-black text-white uppercase tracking-wider whitespace-nowrap">Episodes</h3>
                <div className="flex-1 h-px bg-white/10" />
            </div>
            {seasonChips.length > 1 && (
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    {seasonChips.map((season) => (
                        <button
                            key={season.id}
                            type="button"
                            onClick={() => onSeasonClick?.(season)}
                            disabled={season.isActive}
                            title={season.title}
                            aria-current={season.isActive ? 'page' : undefined}
                            className={`min-h-10 rounded-full border px-5 text-sm font-bold transition-all ${
                                season.isActive
                                    ? 'border-blue-300 bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                    : 'border-white/10 bg-white/[0.07] text-gray-300 hover:border-white/25 hover:bg-white/[0.11] hover:text-white'
                            } disabled:cursor-default`}
                        >
                            {season.label}
                        </button>
                    ))}
                </div>
            )}
            <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {isLoading ? (
                        Array.from({ length: skeletonCount }).map((_, index) => <EpisodeCardSkeleton key={`episode-skeleton-${index}`} />)
                    ) : episodes.length > 0 ? (
                        episodes.map((ep) => {
                            const watchedKey = getEpisodeWatchKey(ep);
                            const isWatched = watchedEpisodes.has(watchedKey);
                            const activeNumbers = [
                                String(ep.episodeNumber),
                                ep.playbackEpisodeNumber ? String(ep.playbackEpisodeNumber) : '',
                                ep._tmdbAbsolute ? String(ep._tmdbAbsolute) : '',
                            ].filter(Boolean);
                            const isActive = Boolean(activeEpParam && activeNumbers.includes(activeEpParam));

                            return (
                                <EpisodeCard
                                    key={`${ep.tmdbSeason || 'ep'}-${ep.tmdbEpisode || ep.episodeNumber}-${ep.playbackEpisodeNumber || ''}`}
                                    episode={ep}
                                    isWatched={isWatched}
                                    isActive={isActive}
                                    fallbackCoverImage={fallbackCoverImage}
                                    onEpisodeClick={onEpisodeClick}
                                />
                            );
                        })
                    ) : (
                        <div className="col-span-full text-gray-500 text-center py-4">No episodes found.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
