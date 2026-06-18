import { useCallback, useEffect, useMemo, useRef, type SyntheticEvent } from 'react';
import Hls from 'hls.js';
import { Maximize, X } from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import type { StreamLink, SubtitleTrack } from '../../../types/stream';
import { API_BASE } from '../../../config/api';
import CustomVideoControls from './CustomVideoControls';
import type { StreamServerKey } from '../../../hooks/useStreams';
import { shouldSkipIntro, shouldSkipOutro, type SkipTimestamp } from '../../../services/skipTimestamps';

const IFRAME_LOAD_TIMEOUT_MS = 18_000;
const NATIVE_LOAD_TIMEOUT_MS = 20_000;
const MEDIA_STALL_TIMEOUT_MS = 14_000;
const HAVE_FUTURE_DATA = 3;

export interface VideoPlayerProps {
    streamUrl?: string;
    episodeSession?: string;
    isHls?: boolean;
    subtitles?: SubtitleTrack[];
    isLoading: boolean;
    hasPlayableSource?: boolean;
    streamExhausted?: boolean;
    skipTimestampsLoading?: boolean;
    onLoad?: () => void;
    onError?: () => void;
    onProgress?: (progress: { currentTime: number; duration: number; ended?: boolean }) => void;
    startAtSeconds?: number;
    onNextEpisode?: () => void;
    onPrevEpisode?: () => void;
    hasNextEpisode?: boolean;
    autoNextEnabled?: boolean;
    onAutoNextChange?: (enabled: boolean) => void;
    autoSkipEnabled?: boolean;
    onAutoSkipChange?: (enabled: boolean) => void;
    skipTimestamps?: SkipTimestamp[];
    selectedAudio: 'sub' | 'dub';
    availableAudios: Array<'sub' | 'dub'>;
    onAudioChange: (audio: 'sub' | 'dub') => void;
    streams: StreamLink[];
    selectedStreamIndex: number;
    isAutoQuality: boolean;
    onQualityChange: (index: number) => void;
    onSetAutoQuality: () => void;
    selectedServer: StreamServerKey;
    serverOptions: Array<{ key: StreamServerKey; label: string }>;
    onServerChange: (server: StreamServerKey) => void;
    displayMode?: 'full' | 'mini';
    onMiniClose?: () => void;
    onMiniExpand?: () => void;
    onPlaybackStateChange?: (state: { isPlaying: boolean }) => void;
    isWide?: boolean;
    onToggleWide?: () => void;
}

export default function VideoPlayer(props: VideoPlayerProps) {
    const {
        streamUrl,
        episodeSession,
        isLoading,
        hasPlayableSource = true,
        streamExhausted = false,
        skipTimestampsLoading = false,
        onLoad,
        onError,
        onProgress,
        startAtSeconds,
        isHls,
        onNextEpisode,
        onPrevEpisode,
        hasNextEpisode,
        autoNextEnabled = true,
        onAutoNextChange,
        autoSkipEnabled = true,
        onAutoSkipChange,
        skipTimestamps = [],
        selectedAudio,
        availableAudios,
        onAudioChange,
        streams,
        selectedStreamIndex,
        isAutoQuality,
        onQualityChange,
        onSetAutoQuality,
        selectedServer,
        serverOptions,
        onServerChange,
        displayMode = 'full',
        onMiniClose,
        onMiniExpand,
        onPlaybackStateChange,
        isWide,
        onToggleWide,
    } = props;

    const onLoadRef = useRef(onLoad);
    const onErrorRef = useRef(onError);
    const onProgressRef = useRef(onProgress);
    const startAtRef = useRef(startAtSeconds);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const lastResolvedStreamUrlRef = useRef<string | undefined>(undefined);
    const hlsRef = useRef<Hls | null>(null);
    const iframeLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nativeLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mediaStallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoSkipPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoNextTriggerKeyRef = useRef('');
    const apiOrigin = API_BASE.replace(/\/+$/, '').replace(/\/api$/i, '');

    const resolvedStreamUrl = useMemo(() => {
        if (!streamUrl) return streamUrl;
        if (streamUrl.includes('/api/scraper/embed')) return streamUrl;
        if (!/^https?:\/\/([^/]+\.)?kwik\./i.test(streamUrl)) return streamUrl;
        return `${apiOrigin}/api/scraper/embed?url=${encodeURIComponent(streamUrl)}`;
    }, [apiOrigin, streamUrl]);

    const shouldUseNativeVideo = useMemo(() => {
        if (!resolvedStreamUrl) return false;
        if (isHls || /\.m3u8(?:[?#]|$)/i.test(resolvedStreamUrl)) return true;
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
        startAtRef.current = startAtSeconds;
    }, [startAtSeconds]);

    const clearIframeLoadTimeout = useCallback(() => {
        if (iframeLoadTimeoutRef.current) {
            clearTimeout(iframeLoadTimeoutRef.current);
            iframeLoadTimeoutRef.current = null;
        }
    }, []);

    const clearMediaStallTimeout = useCallback(() => {
        if (mediaStallTimeoutRef.current) {
            clearTimeout(mediaStallTimeoutRef.current);
            mediaStallTimeoutRef.current = null;
        }
    }, []);

    const clearAutoSkipPoll = useCallback(() => {
        if (autoSkipPollRef.current) {
            clearInterval(autoSkipPollRef.current);
            autoSkipPollRef.current = null;
        }
    }, []);

    const clearNativeLoadTimeout = useCallback(() => {
        if (nativeLoadTimeoutRef.current) {
            clearTimeout(nativeLoadTimeoutRef.current);
            nativeLoadTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !shouldUseNativeVideo) return;
        const sourceChanged = lastResolvedStreamUrlRef.current !== resolvedStreamUrl;
        lastResolvedStreamUrlRef.current = resolvedStreamUrl;
        if (!sourceChanged) return;

        const start = Number(startAtRef.current || 0);
        const applyStart = () => {
            if (start > 0 && Number.isFinite(video.duration) && start < video.duration - 1) {
                video.currentTime = start;
            }
        };

        if (video.readyState >= 1) applyStart();
        video.addEventListener('loadedmetadata', applyStart, { once: true });
        return () => video.removeEventListener('loadedmetadata', applyStart);
    }, [resolvedStreamUrl, shouldUseNativeVideo]);

    useEffect(() => {
        clearIframeLoadTimeout();
        if (!resolvedStreamUrl || shouldUseNativeVideo) return;

        iframeLoadTimeoutRef.current = setTimeout(() => {
            iframeLoadTimeoutRef.current = null;
            onErrorRef.current?.();
        }, IFRAME_LOAD_TIMEOUT_MS);

        return clearIframeLoadTimeout;
    }, [clearIframeLoadTimeout, resolvedStreamUrl, shouldUseNativeVideo]);

    useEffect(() => {
        clearNativeLoadTimeout();
        const video = videoRef.current;
        if (!video || !shouldUseNativeVideo || !resolvedStreamUrl) return;

        const clearIfReady = () => {
            if (video.readyState >= HAVE_FUTURE_DATA) {
                clearNativeLoadTimeout();
            }
        };

        nativeLoadTimeoutRef.current = setTimeout(() => {
            nativeLoadTimeoutRef.current = null;
            if (!video.ended && video.readyState < HAVE_FUTURE_DATA) {
                onErrorRef.current?.();
            }
        }, NATIVE_LOAD_TIMEOUT_MS);

        video.addEventListener('canplay', clearIfReady);
        video.addEventListener('canplaythrough', clearIfReady);
        video.addEventListener('playing', clearIfReady);
        video.addEventListener('timeupdate', clearIfReady);
        clearIfReady();

        return () => {
            video.removeEventListener('canplay', clearIfReady);
            video.removeEventListener('canplaythrough', clearIfReady);
            video.removeEventListener('playing', clearIfReady);
            video.removeEventListener('timeupdate', clearIfReady);
            clearNativeLoadTimeout();
        };
    }, [clearNativeLoadTimeout, resolvedStreamUrl, shouldUseNativeVideo]);

    useEffect(() => {
        clearMediaStallTimeout();
        const video = videoRef.current;
        if (!video || !shouldUseNativeVideo || !resolvedStreamUrl) return;

        let lastAdvancedAt = Date.now();
        let lastTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;

        const markAdvanced = () => {
            const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
            if (currentTime > lastTime + 0.2 || video.readyState >= HAVE_FUTURE_DATA) {
                lastTime = Math.max(lastTime, currentTime);
                lastAdvancedAt = Date.now();
            }
            if (video.readyState >= HAVE_FUTURE_DATA || video.paused || video.ended) {
                clearMediaStallTimeout();
            }
        };

        const scheduleStallRetry = () => {
            clearMediaStallTimeout();
            if (video.paused || video.ended) return;

            const stalledUrl = resolvedStreamUrl;
            mediaStallTimeoutRef.current = setTimeout(() => {
                mediaStallTimeoutRef.current = null;
                if (resolvedStreamUrl !== stalledUrl || video.paused || video.ended) return;

                const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
                const playbackStagnant = Math.abs(currentTime - lastTime) < 0.25;
                const stillWaitingForData = video.readyState < HAVE_FUTURE_DATA;
                const advancedRecently = Date.now() - lastAdvancedAt < MEDIA_STALL_TIMEOUT_MS - 1000;

                if (playbackStagnant && stillWaitingForData && !advancedRecently) {
                    onErrorRef.current?.();
                    return;
                }

                lastTime = currentTime;
                scheduleStallRetry();
            }, MEDIA_STALL_TIMEOUT_MS);
        };

        const handlePotentialStall = () => {
            lastTime = Number.isFinite(video.currentTime) ? video.currentTime : lastTime;
            scheduleStallRetry();
        };

        video.addEventListener('waiting', handlePotentialStall);
        video.addEventListener('stalled', handlePotentialStall);
        video.addEventListener('seeking', handlePotentialStall);
        video.addEventListener('playing', markAdvanced);
        video.addEventListener('canplay', markAdvanced);
        video.addEventListener('canplaythrough', markAdvanced);
        video.addEventListener('timeupdate', markAdvanced);
        video.addEventListener('seeked', markAdvanced);

        if (video.autoplay && video.readyState < HAVE_FUTURE_DATA) {
            scheduleStallRetry();
        }

        return () => {
            video.removeEventListener('waiting', handlePotentialStall);
            video.removeEventListener('stalled', handlePotentialStall);
            video.removeEventListener('seeking', handlePotentialStall);
            video.removeEventListener('playing', markAdvanced);
            video.removeEventListener('canplay', markAdvanced);
            video.removeEventListener('canplaythrough', markAdvanced);
            video.removeEventListener('timeupdate', markAdvanced);
            video.removeEventListener('seeked', markAdvanced);
            clearMediaStallTimeout();
        };
    }, [clearMediaStallTimeout, resolvedStreamUrl, shouldUseNativeVideo]);

    useEffect(() => {
        autoNextTriggerKeyRef.current = '';
    }, [episodeSession, resolvedStreamUrl]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !shouldUseNativeVideo || !resolvedStreamUrl) return;

        const isHlsStream = Boolean(isHls) || /\.m3u8(?:[?#]|$)/i.test(resolvedStreamUrl);
        if (!isHlsStream) return;

        hlsRef.current?.destroy();
        hlsRef.current = null;

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = resolvedStreamUrl;
            return;
        }

        if (!Hls.isSupported()) {
            video.src = resolvedStreamUrl;
            return;
        }

        let hlsRecoveryAttempts = 0;
        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            manifestLoadingTimeOut: 10_000,
            manifestLoadingMaxRetry: 2,
            levelLoadingTimeOut: 10_000,
            levelLoadingMaxRetry: 2,
            fragLoadingTimeOut: 15_000,
            fragLoadingMaxRetry: 2,
        });
        hlsRef.current = hls;
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls.loadSource(resolvedStreamUrl);
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
                if (hlsRecoveryAttempts < 2 && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    hlsRecoveryAttempts += 1;
                    hls.startLoad();
                    return;
                }
                if (hlsRecoveryAttempts < 2 && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hlsRecoveryAttempts += 1;
                    hls.recoverMediaError();
                    return;
                }
                onErrorRef.current?.();
            }
        });

        return () => {
            hls.destroy();
            if (hlsRef.current === hls) {
                hlsRef.current = null;
            }
        };
    }, [isHls, resolvedStreamUrl, shouldUseNativeVideo]);

    const handleNativeEnded = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
        const video = event.currentTarget;
        onProgressRef.current?.({
            currentTime: video.currentTime,
            duration: video.duration,
            ended: true,
        });

        if (!autoNextEnabled || !hasNextEpisode || !onNextEpisode) return;

        const triggerKey = `${episodeSession ?? ''}::${resolvedStreamUrl ?? ''}`;
        if (autoNextTriggerKeyRef.current === triggerKey) return;
        autoNextTriggerKeyRef.current = triggerKey;

        window.setTimeout(() => {
            onNextEpisode();
        }, 650);
    }, [autoNextEnabled, episodeSession, hasNextEpisode, onNextEpisode, resolvedStreamUrl]);

    const runAutoSkipCheck = useCallback((video: HTMLVideoElement) => {
        if (!autoSkipEnabled || skipTimestamps.length === 0) return;
        if (video.paused || video.ended) return;

        const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const skipBuffer = 0.1;

        const introTarget = shouldSkipIntro(currentTime, skipTimestamps);
        if (introTarget !== null) {
            const nextTime = Math.min(duration || introTarget, introTarget + skipBuffer);
            if (Number.isFinite(nextTime) && nextTime > currentTime + 0.01) {
                video.currentTime = nextTime;
            }
            return;
        }

        const outroTarget = shouldSkipOutro(currentTime, skipTimestamps, duration);
        if (outroTarget !== null) {
            const nextTime = Math.min(duration || outroTarget, outroTarget + skipBuffer);
            if (Number.isFinite(nextTime) && nextTime > currentTime + 0.01) {
                video.currentTime = nextTime;
            }
        }
    }, [autoSkipEnabled, skipTimestamps]);

    useEffect(() => {
        clearAutoSkipPoll();
        const video = videoRef.current;
        if (!video || !shouldUseNativeVideo || !resolvedStreamUrl) return;

        const startAutoSkipPoll = () => {
            runAutoSkipCheck(video);
            if (autoSkipEnabled && skipTimestamps.length > 0 && !video.paused && !video.ended && !autoSkipPollRef.current) {
                autoSkipPollRef.current = setInterval(() => {
                    runAutoSkipCheck(video);
                }, 250);
            }
        };

        const stopAutoSkipPoll = () => {
            clearAutoSkipPoll();
        };

        video.addEventListener('loadedmetadata', startAutoSkipPoll);
        video.addEventListener('playing', startAutoSkipPoll);
        video.addEventListener('seeked', startAutoSkipPoll);
        video.addEventListener('timeupdate', startAutoSkipPoll);
        video.addEventListener('pause', stopAutoSkipPoll);
        video.addEventListener('ended', stopAutoSkipPoll);

        startAutoSkipPoll();

        return () => {
            video.removeEventListener('loadedmetadata', startAutoSkipPoll);
            video.removeEventListener('playing', startAutoSkipPoll);
            video.removeEventListener('seeked', startAutoSkipPoll);
            video.removeEventListener('timeupdate', startAutoSkipPoll);
            video.removeEventListener('pause', stopAutoSkipPoll);
            video.removeEventListener('ended', stopAutoSkipPoll);
            clearAutoSkipPoll();
        };
    }, [autoSkipEnabled, clearAutoSkipPoll, resolvedStreamUrl, runAutoSkipCheck, shouldUseNativeVideo, skipTimestamps.length, videoRef]);

    return (
        <div className={`watch-player-shell w-full max-w-full h-full max-h-full relative bg-[#0b0c0f] group transition-all duration-300 overflow-hidden rounded-none shadow-none outline-none ${displayMode === 'mini' ? 'rounded-xl shadow-2xl shadow-black/70' : 'md:rounded-2xl md:shadow-2xl md:shadow-black/80'}`}>
            {resolvedStreamUrl ? (
                <div className="relative w-full max-w-full h-full bg-black flex items-center justify-center z-10 overflow-hidden rounded-none md:rounded-2xl">
                    <div className="w-full h-full max-w-full max-h-full flex items-center justify-center bg-black overflow-hidden rounded-none md:rounded-2xl">
                        {shouldUseNativeVideo ? (
                            <>
                                <video
                                    ref={videoRef}
                                    src={isHls || /\.m3u8(?:[?#]|$)/i.test(resolvedStreamUrl) ? undefined : resolvedStreamUrl}
                                    className="w-full h-full bg-black cursor-pointer object-contain"
                                    onClick={() => {
                                        if (videoRef.current?.paused) videoRef.current.play();
                                        else videoRef.current?.pause();
                                    }}
                                    onPlay={() => onPlaybackStateChange?.({ isPlaying: true })}
                                    onPause={() => onPlaybackStateChange?.({ isPlaying: false })}
                                    playsInline
                                    autoPlay
                                    preload="auto"
                                    crossOrigin="anonymous"
                                    disableRemotePlayback={false}
                                    onCanPlay={() => onLoadRef.current?.()}
                                    onError={() => onErrorRef.current?.()}
                                    onTimeUpdate={(event) => {
                                        const video = event.currentTarget;
                                        onProgressRef.current?.({
                                            currentTime: video.currentTime,
                                            duration: video.duration,
                                            ended: video.ended,
                                        });
                                        runAutoSkipCheck(video);
                                    }}
                                    onEnded={handleNativeEnded}
                                />
                                <CustomVideoControls
                                    streamKey={`${episodeSession ?? ''}::${resolvedStreamUrl ?? ''}`}
                                    videoRef={videoRef}
                                    onNextEpisode={onNextEpisode}
                                    onPrevEpisode={onPrevEpisode}
                                    hasNextEpisode={hasNextEpisode}
                                    autoNextEnabled={autoNextEnabled}
                                    onAutoNextChange={onAutoNextChange}
                                    autoSkipEnabled={autoSkipEnabled}
                                    onAutoSkipChange={onAutoSkipChange}
                                    skipTimestamps={skipTimestamps}
                                    skipTimestampsLoading={skipTimestampsLoading}
                                    selectedAudio={selectedAudio}
                                    availableAudios={availableAudios}
                                    onAudioChange={onAudioChange}
                                    streams={streams}
                                    selectedStreamIndex={selectedStreamIndex}
                                    isAutoQuality={isAutoQuality}
                                    onQualityChange={onQualityChange}
                                    onSetAutoQuality={onSetAutoQuality}
                                    selectedServer={selectedServer}
                                    serverOptions={serverOptions}
                                    onServerChange={onServerChange}
                                    mode={displayMode}
                                    onMiniClose={onMiniClose}
                                    onMiniExpand={onMiniExpand}
                                    isWide={isWide}
                                    onToggleWide={onToggleWide}
                                />
                            </>
                        ) : (
                            <>
                                <iframe
                                    key={`${episodeSession ?? ''}::${resolvedStreamUrl ?? ''}`}
                                    src={resolvedStreamUrl}
                                    className="w-full h-full border-0 bg-black"
                                    loading="eager"
                                    allowFullScreen
                                    allow="autoplay; encrypted-media"
                                    referrerPolicy="no-referrer"
                                    title="Video Player"
                                    onLoad={() => {
                                        clearIframeLoadTimeout();
                                        onLoadRef.current?.();
                                        onPlaybackStateChange?.({ isPlaying: true });
                                    }}
                                />
                                {displayMode === 'mini' && (
                                    <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-2 bg-gradient-to-b from-black/55 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onMiniExpand?.();
                                            }}
                                            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
                                            title="Back to player"
                                        >
                                            <Maximize className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onMiniClose?.();
                                            }}
                                            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
                                            title="Close"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {isLoading && (
                        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/55">
                            <LoadingSpinner />
                            <p className="mt-4 text-gray-300 animate-pulse">fetching anime episode...</p>
                        </div>
                    )}
                </div>
            ) : isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
                    <LoadingSpinner />
                    <p className="mt-4 text-gray-400 animate-pulse">fetching anime episode...</p>
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
