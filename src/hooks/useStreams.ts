import { useState, useRef, useCallback, useMemo, useEffect } from 'react';

import type { Episode } from '../types/anime';
import type { StreamLink } from '../types/stream';
import { animeService } from '../services/animeService';
import { getStreamData, getMappedQuality } from '../utils/streamUtils';

const getSourceKey = (stream: StreamLink) => {
    const server = String(stream.server || '').trim().toLowerCase();
    const provider = String(stream.provider || '').trim().toLowerCase();
    if (server) return server;
    if (provider) return provider;
    if (stream.isHls) return 'hls';
    return 'embed';
};

const getSourceLabel = (stream: StreamLink) => {
    const key = getSourceKey(stream);
    if (key === 'native') return 'Native HLS';
    if (key === 'kwik') return 'Kwik';
    if (key === 'hls') return 'HLS';
    if (key === 'embed') return 'Embed';
    if (key === 'gogoanime' || key.startsWith('gogoanime-')) return 'GogoAnime';
    if (key === 'gogoanime-hd-1') return 'GogoAnime HD-1';
    if (key === 'gogoanime-hd-2') return 'GogoAnime HD-2';
    return key
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
};

type StreamLookupMetadata = {
    titlesKey?: string;
    year?: string | number;
    format?: string;
};

export type StreamServerKey = 'auto' | 'allmanga' | 'videasy';

export const STREAM_SERVER_OPTIONS: Array<{ key: StreamServerKey; label: string }> = [
    { key: 'videasy', label: 'Videasy (Fastest)' },
    { key: 'auto', label: 'Default (AllManga)' },
];


export function useStreams(scraperSession: string | null, animeTitle?: string, animeMetadata?: StreamLookupMetadata) {
    const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
    const [allStreams, setAllStreams] = useState<StreamLink[]>([]);
    const [streams, setStreams] = useState<StreamLink[]>([]);
    const [selectedStreamIndex, setSelectedStreamIndex] = useState<number>(0);
    const [isAutoQuality, setIsAutoQuality] = useState(true);
    const [selectedAudio, setSelectedAudio] = useState<'sub' | 'dub'>('sub');
    const [selectedServer, setSelectedServer] = useState<StreamServerKey>('videasy');
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [streamLoading, setStreamLoading] = useState(false);
    const streamCache = useRef(new Map<string, Promise<StreamLink[]>>());
    const activeLoadRequestRef = useRef(0);
    const previousServerRef = useRef<StreamServerKey>('videasy');

    const currentStream = streams[selectedStreamIndex] || null;
    const normalizeDirectScraperSession = (value: unknown) => {
        const normalized = String(value || '')
            .trim()
            .replace(/^s:/i, '')
            .replace(/^https?:\/\/[^/]+/i, '')
            .replace(/^\/+/, '')
            .replace(/^watch\//i, '');
        if (!normalized || /^\d+$/.test(normalized)) return '';
        return normalized;
    };

    const normalizeAudio = (value: string) => {
        const lower = String(value || '').trim().toLowerCase();
        if (!lower) return 'sub';
        if (/(^|\b)(dub|eng|english)(\b|$)/.test(lower)) return 'dub';
        return 'sub';
    };
    const scoreStream = useCallback((stream: StreamLink) => {
        const quality = parseInt(String(stream.quality || '0'), 10) || 0;
        const url = String(stream.url || '');
        const directUrl = String(stream.directUrl || '');
        const hasDirectUrl = Boolean(directUrl);
        const isHls = Boolean(stream.isHls) || url.includes('.m3u8') || directUrl.includes('.m3u8');
        const isIframeLike = /vidsrc|vidstream|megacloud|embed|kwik/i.test(url) || !isHls;

        return (isHls ? 1_000_000 : 0)
            + (hasDirectUrl ? 100_000 : 0)
            - (isIframeLike ? 1_000_000 : 0)
            + quality;
    }, []);

    const metadataYear = animeMetadata?.year;
    const metadataFormat = animeMetadata?.format;
    const metadataTitlesKey = animeMetadata?.titlesKey || '';
    const ensureStreamData = useCallback((episode: Episode): Promise<StreamLink[]> => {
        const activeSession = normalizeDirectScraperSession(scraperSession);
        if (!activeSession) return Promise.resolve([]);
        const cacheKey = `${selectedServer}:${episode.session}`;
        if (!streamCache.current.has(cacheKey)) {
            const promise = getStreamData(episode, activeSession, {
                provider: selectedServer,
                title: animeTitle,
                titles: metadataTitlesKey ? metadataTitlesKey.split('|') : undefined,
                year: metadataYear,
                format: metadataFormat,
            })
                .then((data) => {
                    if (!Array.isArray(data) || data.length === 0) {
                        streamCache.current.delete(cacheKey);
                        return [];
                    }
                    return data;
                })
                .catch(e => {
                    console.error('Failed to load stream', e);
                    streamCache.current.delete(cacheKey);
                    return [];
                });
            streamCache.current.set(cacheKey, promise);
        }
        return streamCache.current.get(cacheKey)!;
    }, [scraperSession, selectedServer, animeTitle, metadataTitlesKey, metadataYear, metadataFormat]);

    const prefetchStream = useCallback((episode: Episode) => {
        if (scraperSession) ensureStreamData(episode);
    }, [scraperSession, ensureStreamData]);

    const availableAudios = useMemo(() => {
        const set = new Set<'sub' | 'dub'>();
        allStreams.forEach((s) => set.add(normalizeAudio(s.audio)));
        if (set.size === 0) set.add('sub');
        return [...set];
    }, [allStreams]);

    const availableSources = useMemo(() => {
        const map = new Map<string, string>();
        const audioStreams = allStreams.filter((s) => normalizeAudio(s.audio) === selectedAudio);
        const sourceStreams = audioStreams.length > 0 ? audioStreams : allStreams;

        sourceStreams.forEach((stream) => {
            const key = getSourceKey(stream);
            if (!map.has(key)) map.set(key, getSourceLabel(stream));
        });

        return [
            { key: 'auto', label: 'Auto' },
            ...Array.from(map.entries()).map(([key, label]) => ({ key, label })),
        ];
    }, [allStreams, selectedAudio]);

    const filterStreams = useCallback((raw: StreamLink[], audio: 'sub' | 'dub') => {
        let next = raw.filter((s) => normalizeAudio(s.audio) === audio);
        if (next.length === 0) next = raw;
        const sorted = [...next].sort((a, b) => scoreStream(b) - scoreStream(a));
        const dedupedBySourceQuality = new Map<string, StreamLink>();

        sorted.forEach((stream) => {
            const qualityKey = getMappedQuality(String(stream.quality || '0'));
            const key = `${getSourceKey(stream)}:${qualityKey}`;
            if (!dedupedBySourceQuality.has(key)) {
                dedupedBySourceQuality.set(key, stream);
            }
        });

        return Array.from(dedupedBySourceQuality.values());
    }, [scoreStream]);

    useEffect(() => {
        if (allStreams.length === 0) {
            setStreams([]);
            return;
        }
        const nextStreams = filterStreams(allStreams, selectedAudio);
        setStreams(nextStreams);
        setSelectedStreamIndex(0);
        setIsAutoQuality(true);
    }, [allStreams, selectedAudio, filterStreams]);

    const loadStream = useCallback(async (episode: Episode) => {
        const requestId = activeLoadRequestRef.current + 1;
        activeLoadRequestRef.current = requestId;
        setCurrentEpisode(episode);
        setStreamLoading(true);
        setAllStreams([]);
        setStreams([]);
        setSelectedStreamIndex(0);

        try {
            const streamData = await ensureStreamData(episode);
            if (activeLoadRequestRef.current !== requestId) {
                return;
            }
            if (streamData.length > 0) {
                const nextAudio = streamData.some((s) => normalizeAudio(s.audio) === selectedAudio)
                    ? selectedAudio
                    : (streamData.some((s) => normalizeAudio(s.audio) === 'sub') ? 'sub' : 'dub');
                const nextStreams = filterStreams(streamData, nextAudio);

                setSelectedAudio(nextAudio);
                setAllStreams(streamData);
                setStreams(nextStreams);
                setIsAutoQuality(true);
            } else {
                streamCache.current.delete(episode.session);
                streamCache.current.delete(`${selectedServer}:${episode.session}`);
            }
        } catch (e) {
            if (activeLoadRequestRef.current !== requestId) {
                return;
            }
            console.error('Failed to load stream', e);
        } finally {
            if (activeLoadRequestRef.current === requestId) {
                setStreamLoading(false);
            }
        }
    }, [ensureStreamData, selectedAudio, filterStreams]);

    useEffect(() => {
        if (previousServerRef.current === selectedServer) return;
        previousServerRef.current = selectedServer;
        if (!currentEpisode) return;
        loadStream(currentEpisode);
    }, [selectedServer, currentEpisode, loadStream]);

    const handleQualityChange = useCallback((index: number) => {
        setSelectedStreamIndex(index);
        setIsAutoQuality(false);
        setShowQualityMenu(false);
    }, []);

    const setAutoQuality = useCallback(() => {
        setSelectedStreamIndex(0);
        setIsAutoQuality(true);
        setShowQualityMenu(false);
    }, []);

    const tryNextStream = useCallback(() => {
        if (streams.length > 0 && selectedStreamIndex < streams.length - 1) {
            setSelectedStreamIndex((idx) => Math.min(idx + 1, streams.length - 1));
            setIsAutoQuality(false);
            return true;
        }

        const alternateAudio: 'sub' | 'dub' = selectedAudio === 'sub' ? 'dub' : 'sub';
        if (availableAudios.includes(alternateAudio)) {
            setSelectedAudio(alternateAudio);
            setSelectedStreamIndex(0);
            setIsAutoQuality(true);
            return true;
        }

        return false;
    }, [streams.length, selectedStreamIndex, selectedAudio, availableAudios]);

    // Clear all stream state when switching anime
    const clearStreams = useCallback(() => {
        activeLoadRequestRef.current += 1;
        setCurrentEpisode(null);
        setAllStreams([]);
        setStreams([]);
        setSelectedStreamIndex(0);
        setSelectedAudio('sub');
        setSelectedServer('videasy');
        setStreamLoading(false);
        streamCache.current.clear();
    }, []);

    // Invalidate cache for a specific episode so the next loadStream call fetches fresh.
    const bustEpisodeCache = useCallback((session: string) => {
        const normalizedSession = String(session || '').trim();
        if (!normalizedSession) return;

        streamCache.current.delete(normalizedSession);
        streamCache.current.delete(`${selectedServer}:${normalizedSession}`);
        for (const key of streamCache.current.keys()) {
            if (key.endsWith(`:${normalizedSession}`)) {
                streamCache.current.delete(key);
            }
        }

        const activeSession = normalizeDirectScraperSession(scraperSession);
        if (activeSession) {
            animeService.invalidateStreamCache(activeSession, normalizedSession, selectedServer);
        }
    }, [scraperSession, selectedServer]);

    const handleServerChange = useCallback((server: StreamServerKey) => {
        const shouldForceReload = server === selectedServer;
        setSelectedServer(server);
        setSelectedStreamIndex(0);
        setIsAutoQuality(true);
        setShowQualityMenu(false);
        if (shouldForceReload && currentEpisode) {
            streamCache.current.delete(`${server}:${currentEpisode.session}`);
            loadStream(currentEpisode);
        }
    }, [currentEpisode, loadStream, selectedServer]);

    return {
        // State
        currentEpisode,
        streams,
        hasResolvedStreams: allStreams.length > 0,
        selectedStreamIndex,
        isAutoQuality,
        selectedAudio,
        selectedServer,
        serverOptions: STREAM_SERVER_OPTIONS,
        availableAudios,
        availableSources,
        showQualityMenu,
        currentStream,
        streamLoading,

        // Actions
        loadStream,
        prefetchStream,
        handleQualityChange,
        setAutoQuality,
        handleServerChange,
        setShowQualityMenu,
        setSelectedAudio,
        tryNextStream,
        getMappedQuality,
        clearStreams,
        bustEpisodeCache,
    };
}
