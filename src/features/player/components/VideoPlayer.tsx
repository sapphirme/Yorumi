import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import Hls from 'hls.js';
import { Maximize, X, Globe, CheckCircle2, Circle } from 'lucide-react';
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

type ThemedWebViewElement = HTMLWebViewElement & {
    insertCSS: (css: string) => Promise<string>;
    executeJavaScript: <T = unknown>(code: string) => Promise<T>;
};

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
    const webviewRef = useRef<ThemedWebViewElement | null>(null);
    const lastResolvedStreamUrlRef = useRef<string | undefined>(undefined);
    const hlsRef = useRef<Hls | null>(null);
    const iframeLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nativeLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mediaStallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoSkipPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoNextTriggerKeyRef = useRef('');
    const apiOrigin = API_BASE.replace(/\/+$/, '').replace(/\/api$/i, '');
    const [showServerMenu, setShowServerMenu] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);
    const getServerDisplayName = (key: string) => {
        if (key === 'videasy') return 'Videasy';
        if (key === 'auto') return 'AllManga';
        return key;
    };

    const resolvedStreamUrl = useMemo(() => {
        if (!streamUrl) return streamUrl;
        let url = streamUrl;
        if (!streamUrl.includes('/api/scraper/embed') && /^https?:\/\/([^/]+\.)?kwik\./i.test(streamUrl)) {
            url = `${apiOrigin}/api/scraper/embed?url=${encodeURIComponent(streamUrl)}`;
        }
        return url;
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
            video.play().catch((err) => {
                console.warn('Autoplay failed or was blocked:', err);
            });
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
        const webview = webviewRef.current;
        if (!webview || shouldUseNativeVideo) return;

        const handleLoad = () => {
            clearIframeLoadTimeout();
            onLoadRef.current?.();
            onPlaybackStateChange?.({ isPlaying: true });

            try {
                // Advanced CSS overrides for modern Tailwind players
                webview.insertCSS(`
                    :root {
                        --primary: #3DB4F2 !important;
                        --primary-color: #3DB4F2 !important;
                        --theme-color: #3DB4F2 !important;
                        --accent: #3DB4F2 !important;
                        --accent-color: #3DB4F2 !important;
                        --red: #3DB4F2 !important;
                        --destructive: #3DB4F2 !important;
                        --plyr-color-main: #3DB4F2 !important;
                    }
                    /* Override Tailwind arbitrary color classes preserving opacity */
                    [class*="bg-\\[\\#e50914\\]"], [class*="bg-\\[\\#E50914\\]"], [class*="bg-\\[\\#ef4444\\]"], [class*="bg-\\[\\#dc2626\\]"], [class*="bg-\\[\\#b91c1c\\]"], [class*="bg-\\[\\#ff0000\\]"], [class*="bg-red-"] {
                        background-color: rgb(61 180 242 / var(--tw-bg-opacity, 1)) !important;
                    }
                    [class*="text-\\[\\#e50914\\]"], [class*="text-\\[\\#E50914\\]"], [class*="text-\\[\\#ef4444\\]"], [class*="text-\\[\\#dc2626\\]"], [class*="text-\\[\\#b91c1c\\]"], [class*="text-\\[\\#ff0000\\]"], [class*="text-red-"] {
                        color: rgb(61 180 242 / var(--tw-text-opacity, 1)) !important;
                    }
                    [class*="border-\\[\\#e50914\\]"], [class*="border-\\[\\#E50914\\]"], [class*="border-\\[\\#ef4444\\]"], [class*="border-\\[\\#dc2626\\]"], [class*="border-\\[\\#b91c1c\\]"], [class*="border-\\[\\#ff0000\\]"], [class*="border-red-"] {
                        border-color: rgb(61 180 242 / var(--tw-border-opacity, 1)) !important;
                    }
                    [class*="ring-\\[\\#e50914\\]"], [class*="ring-\\[\\#E50914\\]"], [class*="ring-\\[\\#ef4444\\]"], [class*="ring-\\[\\#dc2626\\]"], [class*="ring-red-"] {
                        --tw-ring-color: rgb(61 180 242 / var(--tw-ring-opacity, 1)) !important;
                    }
                    /* Also handle SVG strokes and fills */
                    [class*="stroke-\\[\\#e50914\\]"], [class*="stroke-\\[\\#ef4444\\]"], [class*="stroke-red-"] { stroke: #3DB4F2 !important; }
                    [class*="fill-\\[\\#e50914\\]"], [class*="fill-\\[\\#ef4444\\]"], [class*="fill-red-"] { fill: #3DB4F2 !important; }
                `);

                // Deep JS mutation observer to forcefully recolor any dynamic or inline styles that are Netflix Red
                webview.executeJavaScript(`
                    (function() {
                        const style = document.createElement('style');
                        style.textContent = \`
                            :root {
                                --primary: #3DB4F2 !important;
                                --primary-color: #3DB4F2 !important;
                                --theme-color: #3DB4F2 !important;
                                --accent: #3DB4F2 !important;
                                --accent-color: #3DB4F2 !important;
                                --red: #3DB4F2 !important;
                                --destructive: #3DB4F2 !important;
                                --plyr-color-main: #3DB4F2 !important;
                            }
                            .text-\\\\[\\\\#e50914\\\\], .text-\\\\[\\\\#E50914\\\\], .text-\\\\[\\\\#ff0000\\\\], .text-primary {
                                color: rgb(61 180 242 / var(--tw-text-opacity, 1)) !important;
                            }
                            .bg-\\\\[\\\\#e50914\\\\], .bg-\\\\[\\\\#E50914\\\\], .bg-\\\\[\\\\#ff0000\\\\], .bg-primary, .plyr__progress__buffer, .vjs-play-progress {
                                background-color: rgb(61 180 242 / var(--tw-bg-opacity, 1)) !important;
                            }
                            .border-\\\\[\\\\#e50914\\\\], .border-\\\\[\\\\#E50914\\\\], .border-\\\\[\\\\#ff0000\\\\], .border-primary {
                                border-color: rgb(61 180 242 / var(--tw-border-opacity, 1)) !important;
                            }
                            [class*="text-red-"], [class*="text-rose-"] {
                                color: rgb(61 180 242 / var(--tw-text-opacity, 1)) !important;
                            }
                            [class*="bg-red-"], [class*="bg-rose-"] {
                                background-color: rgb(61 180 242 / var(--tw-bg-opacity, 1)) !important;
                            }
                            [class*="border-red-"], [class*="border-rose-"] {
                                border-color: rgb(61 180 242 / var(--tw-border-opacity, 1)) !important;
                            }
                            [class*="ring-red-"], [class*="ring-rose-"] {
                                --tw-ring-color: rgb(61 180 242 / var(--tw-ring-opacity, 1)) !important;
                            }
                            /* Hardcoded CSS rule overrides */
                            [style*="color: rgb(229, 9, 20)"], [style*="color: rgb(239, 68, 68)"], [style*="color: rgb(220, 38, 38)"], [style*="color: #e50914"], [style*="color: #E50914"], [style*="color: #ef4444"], [style*="color: #dc2626"], [style*="color: #ff0000"] {
                                color: #3DB4F2 !important;
                            }
                            [style*="background-color: rgb(229, 9, 20)"], [style*="background-color: rgb(239, 68, 68)"], [style*="background-color: rgb(220, 38, 38)"], [style*="background-color: #e50914"], [style*="background-color: #E50914"], [style*="background-color: #ef4444"], [style*="background-color: #dc2626"], [style*="background-color: #ff0000"] {
                                background-color: #3DB4F2 !important;
                            }
                            [style*="border-color: rgb(229, 9, 20)"], [style*="border-color: rgb(239, 68, 68)"], [style*="border-color: rgb(220, 38, 38)"], [style*="border-color: #e50914"], [style*="border-color: #E50914"], [style*="border-color: #ef4444"], [style*="border-color: #dc2626"], [style*="border-color: #ff0000"] {
                                border-color: #3DB4F2 !important;
                            }
                        \`;
                        document.head.appendChild(style);
                        
                        const isRed = (str) => str && (str.includes('229, 9, 20') || str.includes('229 9 20') || str.includes('239, 68, 68') || str.includes('239 68 68') || str.includes('220, 38, 38') || str.includes('220 38 38') || str.includes('185, 28, 28') || str.includes('185 28 28') || str.includes('#e50914') || str.includes('#E50914') || str.includes('#ef4444') || str.includes('#dc2626') || str.includes('#b91c1c'));
                        const toBlue = (str) => {
                            if (!str) return str;
                            return str.replace(/229,\\s*9,\\s*20/g, '61, 180, 242')
                                      .replace(/229\\s+9\\s+20/g, '61 180 242')
                                      .replace(/239,\\s*68,\\s*68/g, '61, 180, 242')
                                      .replace(/239\\s+68\\s+68/g, '61 180 242')
                                      .replace(/220,\\s*38,\\s*38/g, '61, 180, 242')
                                      .replace(/220\\s+38\\s+38/g, '61 180 242')
                                      .replace(/185,\\s*28,\\s*28/g, '61, 180, 242')
                                      .replace(/185\\s+28\\s+28/g, '61 180 242')
                                      .replace(/#e50914|#ef4444|#dc2626|#b91c1c/gi, '#3DB4F2');
                        };

                        // Force update all current inline styles globally and gracefully handle opacities
                        const walk = (node) => {
                            if (node.style) {
                                if (isRed(node.style.color)) node.style.setProperty('color', toBlue(node.style.color), 'important');
                                if (isRed(node.style.backgroundColor)) node.style.setProperty('background-color', toBlue(node.style.backgroundColor), 'important');
                                if (isRed(node.style.borderColor)) node.style.setProperty('border-color', toBlue(node.style.borderColor), 'important');
                                if (isRed(node.style.outlineColor)) node.style.setProperty('outline-color', toBlue(node.style.outlineColor), 'important');
                                if (isRed(node.style.boxShadow)) node.style.setProperty('box-shadow', toBlue(node.style.boxShadow), 'important');
                            }
                            if (node.childNodes && node.childNodes.length > 0) {
                                for (let i = 0; i < node.childNodes.length; i++) {
                                    walk(node.childNodes[i]);
                                }
                            }
                        };
                        
                        const performPass = () => walk(document.body);
                        performPass();
                        
                        // Use mutation observer for high performance instead of setInterval if possible
                        const observer = new MutationObserver((mutations) => {
                            let shouldWalk = false;
                            for (const m of mutations) {
                                if (m.addedNodes.length > 0 || m.attributeName === 'style' || m.attributeName === 'class') {
                                    shouldWalk = true;
                                    break;
                                }
                            }
                            if (shouldWalk) performPass();
                        });
                        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
                        
                        // Failsafe
                        setInterval(performPass, 1000);
                    })();
                `);
            } catch (e) {
                console.error("Failed to inject theme CSS into webview", e);
            }
        };

        webview.addEventListener('did-finish-load', handleLoad);
        return () => {
            webview.removeEventListener('did-finish-load', handleLoad);
        };
    }, [clearIframeLoadTimeout, resolvedStreamUrl, shouldUseNativeVideo, onPlaybackStateChange]);

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
                                <webview
                                    ref={webviewRef}
                                    key={`${episodeSession ?? ''}::${resolvedStreamUrl ?? ''}`}
                                    src={resolvedStreamUrl}
                                    partition="persist:player"
                                    className="w-full h-full border-0 bg-black"
                                    allowpopups={false}
                                    title="Video Player"
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
                    {displayMode !== 'mini' && !isFullscreen && (
                        <div 
                            className={`absolute top-0 left-0 p-4 sm:p-6 transition-opacity duration-300 z-[2147483647] ${showServerMenu ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none'}`}
                        >
                            <div className="pointer-events-auto relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowServerMenu(!showServerMenu);
                                    }}
                                    className="flex items-center gap-2 rounded-full watch-control-glass px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow-[0_8px_28px_rgba(0,0,0,0.28)] transition-all hover:bg-white/20 active:scale-95 border border-white/10"
                                >
                                    <Globe className="h-3.5 w-3.5 text-white/90" />
                                    <span>{getServerDisplayName(selectedServer)}</span>
                                </button>
                                
                                {showServerMenu && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowServerMenu(false)} />
                                        <div className="absolute left-0 mt-3 w-56 rounded-2xl bg-[#1A1A1A]/95 p-2 shadow-2xl backdrop-blur-xl border border-white/10 flex flex-col gap-1 z-50">
                                            {serverOptions.map((server) => {
                                                const isSelected = selectedServer === server.key;
                                                const name = getServerDisplayName(server.key);
                                                return (
                                                    <button
                                                        key={server.key}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onServerChange(server.key);
                                                            onSetAutoQuality();
                                                            setShowServerMenu(false);
                                                        }}
                                                        className={`flex w-full items-center justify-between rounded-xl p-3 text-left transition-colors ${isSelected ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10'}`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm ${isSelected ? 'font-semibold' : 'font-medium'}`}>{name}</span>
                                                            {server.key === 'auto' && (
                                                                <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-400 tracking-wider">ANIME</span>
                                                            )}
                                                        </div>
                                                        {isSelected ? <CheckCircle2 className="h-4 w-4 text-white" /> : <Circle className="h-4 w-4 text-white/35" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
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
