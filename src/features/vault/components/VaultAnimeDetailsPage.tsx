import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import Hls from 'hls.js';
import { API_BASE } from '../../../config/api';
import DetailsHero from '../../anime/components/details/DetailsHero';
import DetailsInfo from '../../anime/components/details/DetailsInfo';
import type { Anime, Episode } from '../../../types/anime';
import { DetailsPageSkeleton } from '../../../pages/AnimeDetailsPage';
import { useWatchList } from '../../../hooks/useWatchList';
import { useContinueWatching } from '../../../hooks/useContinueWatching';

interface VaultAnimeDetailsPageProps {
    id: string; // vault-anime:hanime:slug
}

export default function VaultAnimeDetailsPage({ id }: VaultAnimeDetailsPageProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedStream, setSelectedStream] = useState<any>(null);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);

    const { isInWatchList, addToWatchList, removeFromWatchList } = useWatchList({ isVault: true });
    const { saveProgress } = useContinueWatching({ isVault: true });
    
    // Create a fakeAnime object outside of render so hooks can access it consistently
    const fakeAnime = useMemo(() => {
        if (!data) return null;
        return {
            id: data.id || id,
            mal_id: data.id || id,
            title: data.title,
            title_english: data.title,
            images: {
                jpg: {
                    image_url: data.poster || data.image,
                    large_image_url: data.image || data.poster
                }
            },
            anilist_banner_image: data.poster || data.image,
            type: 'Vault Video',
            score: data.views ? Math.min(9.9, parseFloat((data.views / 100000 + 5.0).toFixed(1))) : undefined,
            year: data.year || data.brand || new Date().getFullYear(),
            episodes: 1,
            synopsis: data.description ? data.description.replace(/<\/?[^>]+(>|$)/g, "") : '',
            genres: data.tags?.map((t: string) => ({ name: t, mal_id: t })) || [],
            status: 'FINISHED',
            rating: data.brand || 'Adult',
        } as unknown as Anime;
    }, [data, id]);

    useEffect(() => {
        let mounted = true;
        const slug = id.split('vault-anime:hanime:')[1];
        if (!slug) {
            setError('Invalid Vault ID');
            setLoading(false);
            return;
        }

        setLoading(true);
        fetch(`${API_BASE}/vault/anime/details/${slug}`)
            .then(res => res.json())
            .then(json => {
                if (!mounted) return;
                if (json.success) {
                    setData(json.data);
                    if (json.data.streams && json.data.streams.length > 0) {
                        const sortedStreams = [...json.data.streams].sort((a, b) => parseInt(b.resolution) - parseInt(a.resolution));
                        setSelectedStream(sortedStreams[0]);
                    }
                } else {
                    setError('Failed to load video details');
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                if (mounted) {
                    setError('Network error');
                    setLoading(false);
                }
            });
        return () => { mounted = false; };
    }, [id]);

    useEffect(() => {
        if (!selectedStream || !videoRef.current || !fakeAnime) return;
        const video = videoRef.current;
        const url = selectedStream.url;

        let hls: Hls | null = null;
        
        const trackProgress = () => {
            saveProgress(fakeAnime, {
                session: 'vault:video',
                episodeNumber: '1',
                title: fakeAnime.title
            } as Episode, {
                positionSeconds: video.currentTime,
                durationSeconds: video.duration || 0
            });
        };

        video.addEventListener('timeupdate', trackProgress);

        if (url.includes('.m3u8') || selectedStream.kind === 'hls' || selectedStream.extension === 'm3u8') {
            const referer = 'https://player.hanime.tv/';
            const proxyUrl = `${API_BASE}/scraper/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}&proxyMedia=1`;

            if (Hls.isSupported()) {
                hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: false,
                });
                hls.loadSource(proxyUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    const resumeTime = parseInt(searchParams.get('t') || '0', 10);
                    if (resumeTime > 0) {
                        video.currentTime = resumeTime;
                    }
                    // Do not auto-play, wait for user
                });
                hls.on(Hls.Events.ERROR, (_event, errData) => {
                    console.error('[Vault HLS] Error:', errData.type, errData.details, errData.fatal ? '(FATAL)' : '');
                    if (errData.fatal) {
                        if (errData.type === Hls.ErrorTypes.NETWORK_ERROR) {
                            hls?.startLoad();
                        } else if (errData.type === Hls.ErrorTypes.MEDIA_ERROR) {
                            hls?.recoverMediaError();
                        }
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = proxyUrl;
                video.addEventListener('loadedmetadata', () => {
                    const resumeTime = parseInt(searchParams.get('t') || '0', 10);
                    if (resumeTime > 0) {
                        video.currentTime = resumeTime;
                    }
                }, { once: true });
            }
        } else {
            video.src = url;
            video.addEventListener('loadedmetadata', () => {
                const resumeTime = parseInt(searchParams.get('t') || '0', 10);
                if (resumeTime > 0) {
                    video.currentTime = resumeTime;
                }
            }, { once: true });
        }

        return () => {
            video.removeEventListener('timeupdate', trackProgress);
            if (hls) hls.destroy();
        };
    }, [selectedStream, fakeAnime, saveProgress]);

    if (loading) return <DetailsPageSkeleton />;
    
    if (error || !data || !fakeAnime) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-white bg-[#0a0a0a]">
                <p className="text-xl mb-4 text-[#ff3a3a]">{error || 'Failed to load video'}</p>
                <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white underline">Go Back</button>
            </div>
        );
    }

    const inWatchList = isInWatchList(String(fakeAnime.id));

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#facc15] selection:text-black pb-20">
            <div className="relative pb-24 md:pb-32 lg:pb-40">
                <DetailsHero anime={fakeAnime} />

                <div className="max-w-7xl mx-auto px-8 md:px-14 -mt-24 md:-mt-32 relative z-10">
                    <DetailsInfo
                        anime={fakeAnime}
                        episodesCount={1}
                        isLoading={false}
                        inList={inWatchList}
                        inFavorites={false}
                        onWatch={() => {
                            document.getElementById('vault-video-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            videoRef.current?.play().catch(() => {});
                        }}
                        onToggleList={() => {
                            if (inWatchList) {
                                removeFromWatchList(String(fakeAnime.id));
                            } else {
                                addToWatchList({
                                    id: String(fakeAnime.id),
                                    scraperId: id,
                                    title: fakeAnime.title,
                                    image: fakeAnime.images.jpg.large_image_url || fakeAnime.images.jpg.image_url,
                                    type: fakeAnime.type,
                                    status: 'watching',
                                    totalCount: fakeAnime.episodes ?? undefined,
                                    score: fakeAnime.score ?? undefined
                                });
                            }
                        }}
                    >
                        <div id="vault-video-player" className="w-full mt-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Episode Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <span className="px-4 py-1.5 bg-yorumi-accent text-black text-sm font-black rounded flex-shrink-0">
                                        E1
                                    </span>
                                    <div className="flex flex-col">
                                        <h2 className="text-xl font-bold text-white truncate max-w-xl">{data.title}</h2>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black relative group">
                                {selectedStream ? (
                                    <video 
                                        ref={videoRef}
                                        poster={data.poster || data.image}
                                        controls
                                        className="w-full h-full object-contain bg-black"
                                        controlsList="nodownload"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-black">
                                        <Play className="w-16 h-16 mb-4 opacity-50" />
                                        <p>No streams available</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DetailsInfo>
                </div>
            </div>
        </div>
    );
}
