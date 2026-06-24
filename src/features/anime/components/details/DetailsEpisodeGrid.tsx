import { useState } from 'react';
import type { Episode, Anime } from '../../../../types/anime';

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
    episodes: Episode[];
    watchedEpisodes: Set<number>;
    activeEpParam: string | null;
    seasonChips?: SeasonChip[];
    tmdbEpisodes?: import('../../../../services/tmdbService').TmdbEpisode[];
    onSeasonClick?: (season: SeasonChip) => void;
    onEpisodeClick: (ep: Episode) => void;
}

export default function DetailsEpisodeGrid({ episodes, watchedEpisodes, activeEpParam, seasonChips = [], tmdbEpisodes = [], onSeasonClick, onEpisodeClick }: DetailsEpisodeGridProps) {

    if (episodes.length === 0) {
        return <div className="text-gray-500 text-center py-4">No episodes found.</div>;
    }

    const visibleEpisodes = episodes;

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
                                    ? 'border-yorumi-accent bg-yorumi-accent text-black'
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
                    {visibleEpisodes.map((ep, index) => {
                        const cleanTitle = ep.title && ep.title.trim().toLowerCase() !== 'untitled' ? ep.title : null;
                        const direct = ep._tmdbAbsolute ?? parseFloat(ep.episodeNumber);
                        const tmdbEp = tmdbEpisodes?.find(t => t.episode_number === direct) || tmdbEpisodes?.[index];
                        const displayTitle = tmdbEp?.name || cleanTitle || `Episode ${ep.episodeNumber}`;
                        const snapshotUrl = tmdbEp?.still_path ? `https://image.tmdb.org/t/p/w780${tmdbEp.still_path}` : ep.snapshot;
                        const isWatched = watchedEpisodes.has(parseFloat(ep.episodeNumber));
                        const isActive = activeEpParam === String(ep.episodeNumber);
                        
                        return (
                            <button
                                key={ep.session || ep.episodeNumber}
                                onClick={() => onEpisodeClick(ep)}
                                className={`flex items-stretch text-left bg-[#141414] rounded-xl overflow-hidden transition-all duration-200 group
                                    ${isActive ? 'ring-1 ring-yorumi-accent bg-[#1a1a1a]' : isWatched ? 'ring-1 ring-green-500/30 bg-green-500/5 hover:bg-green-500/10' : 'hover:bg-[#1a1a1a]'} 
                                    hover:scale-[1.02] cursor-pointer`}
                                title={displayTitle}
                            >
                                <div className="w-28 sm:w-32 aspect-video shrink-0 relative bg-[#0a0a0a]">
                                    <EpisodeThumbnail src={snapshotUrl} label={`E${ep.episodeNumber}`} />
                                    {/* Active "PLAYING" Overlay */}
                                    {isActive ? (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                                            <div className="flex items-center gap-1.5 text-white font-bold text-xs tracking-wider">
                                                <div className="w-2 h-2 rounded-full bg-yorumi-accent animate-pulse" />
                                                PLAYING
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
                                        <span className={`font-black text-xs uppercase tracking-wider ${isWatched ? 'text-green-500' : 'text-yorumi-accent'}`}>E{ep.episodeNumber}</span>
                                        {isWatched && (
                                            <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`font-semibold text-sm line-clamp-2 mt-0.5 leading-snug min-h-[2.5rem] ${isWatched ? 'text-green-50' : 'text-white'}`}>{displayTitle}</span>
                                </div>
                            </button>
                        );
                        })}
                </div>
            </div>
        </div>
    );
}