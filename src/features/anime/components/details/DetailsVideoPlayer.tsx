import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { usePersistentPlayer } from '../../../player/context/PersistentPlayerContext';
import { usePlayer } from '../../../player/hooks/usePlayer';

interface DetailsVideoPlayerProps {
    animeId: string;
    animeTitle?: string;
    onClose: () => void;
    isWatched?: boolean;
    onMarkWatched?: () => void;
}

export default function DetailsVideoPlayer({ animeId, animeTitle, onClose, isWatched, onMarkWatched }: DetailsVideoPlayerProps) {
    const location = useLocation();
    const { registerPlayer, setInlinePlayerElement } = usePersistentPlayer();

    const {
        anime,
        currentEpisode,
        currentStream,
        streams,
        error,
        epNum,
        cleanCurrentTitle,
        resumeAtSeconds,
        streamLoading,
        streamExhausted,
        skipTimestampsLoading,
        isExpanded,
        isAutoQuality,
        autoNextEnabled,
        autoSkipEnabled,
        selectedAudio,
        selectedServer,
        serverOptions,
        availableAudios,
        selectedStreamIndex,
        skipTimestamps,
        handlePrevEp,
        handleNextEp,
        handleQualityChange,
        setAutoQuality,
        setAutoNextEnabled,
        setAutoSkipEnabled,
        setSelectedServer,
        setSelectedAudio,
        canPrevEpisode,
        canNextEpisode,
        setIsPlayerReady,
        handlePlaybackProgress,
        handleStreamError,
        toggleExpand,
    } = usePlayer(animeId, animeTitle);

    const playerProps = useMemo(() => ({
        streamUrl: currentStream?.url,
        episodeSession: currentEpisode?.session ?? epNum,
        isHls: currentStream?.isHls,
        subtitles: currentStream?.subtitles,
        isLoading: streamLoading,
        streamExhausted,
        skipTimestampsLoading,
        hasPlayableSource: !currentEpisode || Boolean(currentStream?.url) || streamLoading,
        onLoad: () => setIsPlayerReady(true),
        onError: handleStreamError,
        onProgress: handlePlaybackProgress,
        startAtSeconds: resumeAtSeconds,
        onNextEpisode: canNextEpisode ? handleNextEp : undefined,
        onPrevEpisode: canPrevEpisode ? handlePrevEp : undefined,
        hasNextEpisode: canNextEpisode,
        autoNextEnabled,
        onAutoNextChange: setAutoNextEnabled,
        autoSkipEnabled,
        onAutoSkipChange: setAutoSkipEnabled,
        skipTimestamps,
        selectedAudio,
        availableAudios,
        onAudioChange: setSelectedAudio,
        streams,
        selectedStreamIndex,
        isAutoQuality,
        onQualityChange: handleQualityChange,
        onSetAutoQuality: setAutoQuality,
        selectedServer,
        serverOptions,
        onServerChange: setSelectedServer,
        isWide: isExpanded,
        onToggleWide: toggleExpand,
    }), [
        availableAudios,
        autoNextEnabled,
        autoSkipEnabled,
        canNextEpisode,
        canPrevEpisode,
        currentEpisode,
        currentStream,
        epNum,
        handleNextEp,
        handlePlaybackProgress,
        handlePrevEp,
        handleQualityChange,
        handleStreamError,
        isAutoQuality,
        isExpanded,
        resumeAtSeconds,
        selectedAudio,
        selectedServer,
        serverOptions,
        selectedStreamIndex,
        setAutoQuality,
        setAutoNextEnabled,
        setAutoSkipEnabled,
        setIsPlayerReady,
        setSelectedAudio,
        setSelectedServer,
        skipTimestamps,
        skipTimestampsLoading,
        streamExhausted,
        streamLoading,
        streams,
        toggleExpand,
    ]);

    useEffect(() => {
        if (error) return;
        registerPlayer(playerProps, `${location.pathname}${location.search}`);
    }, [error, location.pathname, location.search, playerProps, registerPlayer]);

    if (error) {
        return (
            <div className="w-full h-48 bg-white/5 rounded-2xl flex items-center justify-center">
                <span className="text-red-400">{error}</span>
            </div>
        );
    }

    return (
        <div id="details-video-player" className="w-full mt-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <span className="px-4 py-1.5 bg-yorumi-accent text-black text-sm font-black rounded flex-shrink-0">
                        E{epNum}
                    </span>
                    <h2 className="text-xl font-bold text-white truncate max-w-xl">
                        {cleanCurrentTitle || `Episode ${epNum}`}
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => {
                            if (onMarkWatched) onMarkWatched();
                        }}
                        className={`px-4 py-2 border rounded-lg text-sm transition-colors flex items-center gap-2 ${
                            isWatched 
                                ? 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30' 
                                : 'border-white/20 text-white hover:bg-white/10'
                        }`}
                    >
                        {isWatched && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {isWatched ? 'Watched' : 'Mark Watched'}
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Close Player"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Video Container */}
            <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                <div ref={setInlinePlayerElement} className="w-full h-full bg-black" />
            </div>
        </div>
    );
}
