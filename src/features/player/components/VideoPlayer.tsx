import { useEffect, useMemo, useRef } from 'react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import type { StreamLink, SubtitleTrack } from '../../../types/stream';
import { API_BASE } from '../../../config/api';
import CustomVideoControls from './CustomVideoControls';
import type { StreamServerKey } from '../../../hooks/useStreams';

interface VideoPlayerProps {
    streamUrl?: string;
    episodeSession?: string;
    isHls?: boolean;
    subtitles?: SubtitleTrack[];
    isLoading: boolean;
    hasPlayableSource?: boolean;
    streamExhausted?: boolean;
    onLoad?: () => void;
    onError?: () => void;
    onProgress?: (progress: { currentTime: number; duration: number; ended?: boolean }) => void;
    startAtSeconds?: number;
    onNextEpisode?: () => void;
    onPrevEpisode?: () => void;
    hasNextEpisode?: boolean;
    selectedAudio: 'sub' | 'dub';
    availableAudios: Array<'sub' | 'dub'>;
    onAudioChange: (audio: 'sub' | 'dub') => void;
    streams: StreamLink[];
    selectedStreamIndex: number;
    isAutoQuality: boolean;
    onQualityChange: (index: number) => void;
    onSetAutoQuality: () => void;
    selectedServer: StreamServerKey;
    onServerChange: (server: StreamServerKey) => void;
}

export default function VideoPlayer(props: VideoPlayerProps) {
    const {
        streamUrl,
        episodeSession,
        isLoading,
        hasPlayableSource = true,
        streamExhausted = false,
        onLoad,
        onError,
        onProgress,
        startAtSeconds,
        isHls,
        onNextEpisode,
        onPrevEpisode,
        hasNextEpisode,
        selectedAudio,
        availableAudios,
        onAudioChange,
        streams,
        selectedStreamIndex,
        isAutoQuality,
        onQualityChange,
        onSetAutoQuality,
        selectedServer,
        onServerChange,
    } = props;

    const onLoadRef = useRef(onLoad);
    const onErrorRef = useRef(onError);
    const onProgressRef = useRef(onProgress);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const apiOrigin = API_BASE.replace(/\/+$/, '').replace(/\/api$/i, '');

    const resolvedStreamUrl = useMemo(() => {
        if (!streamUrl) return streamUrl;
        if (streamUrl.includes('/api/scraper/embed')) return streamUrl;
        if (!/^https?:\/\/([^/]+\.)?kwik\./i.test(streamUrl)) return streamUrl;
        return `${apiOrigin}/api/scraper/embed?url=${encodeURIComponent(streamUrl)}`;
    }, [apiOrigin, streamUrl]);

    const shouldUseNativeVideo = useMemo(() => {
        if (!resolvedStreamUrl || isHls) return false;
        if (/\/api\/scraper\/embed\?/i.test(resolvedStreamUrl)) return false;
        if (/\/api\/scraper\/proxy\?/i.test(resolvedStreamUrl)) return true;
        if (/\.(mp4|webm|mkv)(?:[?#]|$)/i.test(resolvedStreamUrl)) return true;
        return /fast4speed\.rsvp|googlevideo\.com/i.test(resolvedStreamUrl);
    }, [isHls, resolvedStreamUrl]);

    useEffect(() => {
        onLoadRef.current = onLoad;
    }, [onLoad]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        onProgressRef.current = onProgress;
    }, [onProgress]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !shouldUseNativeVideo) return;
        const start = Number(startAtSeconds || 0);
        if (start <= 0) return;

        const applyStart = () => {
            if (Number.isFinite(video.duration) && start < video.duration - 1) {
                video.currentTime = start;
            }
        };

        if (video.readyState >= 1) applyStart();
        video.addEventListener('loadedmetadata', applyStart, { once: true });
        return () => video.removeEventListener('loadedmetadata', applyStart);
    }, [resolvedStreamUrl, shouldUseNativeVideo, startAtSeconds]);

    return (
        <div className="watch-player-shell w-full max-w-full h-full max-h-full relative bg-[#0b0c0f] group transition-all duration-300 overflow-hidden rounded-none shadow-none md:rounded-2xl md:shadow-2xl md:shadow-black/80">
            {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
                    <LoadingSpinner />
                    <p className="mt-4 text-gray-400 animate-pulse">Loading Stream...</p>
                </div>
            ) : resolvedStreamUrl ? (
                <div className="relative w-full max-w-full h-full bg-black flex items-center justify-center z-10 overflow-hidden rounded-none md:rounded-2xl">
                    <div className="w-full h-full max-w-full max-h-full flex items-center justify-center bg-black overflow-hidden rounded-none md:rounded-2xl">
                        {shouldUseNativeVideo ? (
                            <>
                                <video
                                    key={`${episodeSession ?? ''}::${resolvedStreamUrl ?? ''}`}
                                    ref={videoRef}
                                    src={resolvedStreamUrl}
                                    className="w-full h-full bg-black cursor-pointer object-contain"
                                    onClick={() => {
                                        if (videoRef.current?.paused) videoRef.current.play();
                                        else videoRef.current?.pause();
                                    }}
                                    playsInline
                                    autoPlay
                                    preload="metadata"
                                    crossOrigin="anonymous"
                                    onCanPlay={() => onLoadRef.current?.()}
                                    onError={() => onErrorRef.current?.()}
                                    onTimeUpdate={(event) => {
                                        const video = event.currentTarget;
                                        onProgressRef.current?.({
                                            currentTime: video.currentTime,
                                            duration: video.duration,
                                            ended: video.ended,
                                        });
                                    }}
                                    onEnded={(event) => {
                                        const video = event.currentTarget;
                                        onProgressRef.current?.({
                                            currentTime: video.currentTime,
                                            duration: video.duration,
                                            ended: true,
                                        });
                                    }}
                                />
                                <CustomVideoControls
                                    streamKey={`${episodeSession ?? ''}::${resolvedStreamUrl ?? ''}`}
                                    videoRef={videoRef}
                                    onNextEpisode={onNextEpisode}
                                    onPrevEpisode={onPrevEpisode}
                                    hasNextEpisode={hasNextEpisode}
                                    selectedAudio={selectedAudio}
                                    availableAudios={availableAudios}
                                    onAudioChange={onAudioChange}
                                    streams={streams}
                                    selectedStreamIndex={selectedStreamIndex}
                                    isAutoQuality={isAutoQuality}
                                    onQualityChange={onQualityChange}
                                    onSetAutoQuality={onSetAutoQuality}
                                    selectedServer={selectedServer}
                                    onServerChange={onServerChange}
                                />
                            </>
                        ) : (
                            <iframe
                                key={`${episodeSession ?? ''}::${resolvedStreamUrl ?? ''}`}
                                src={resolvedStreamUrl}
                                className="w-full h-full border-0 bg-black"
                                loading="eager"
                                allowFullScreen
                                allow="autoplay; encrypted-media"
                                referrerPolicy="no-referrer"
                                title="Video Player"
                                onLoad={() => onLoadRef.current?.()}
                            />
                        )}
                    </div>
                </div>
            ) : !hasPlayableSource || streamExhausted ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
                    <LoadingSpinner />
                    <p className="mt-4 text-gray-400 animate-pulse">
                        {streamExhausted ? 'Still retrying stream...' : 'Retrying stream...'}
                    </p>
                </div>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                    <span className="mb-2 text-6xl opacity-20">▶</span>
                    <p>Select an episode</p>
                </div>
            )}
        </div>
    );
}
