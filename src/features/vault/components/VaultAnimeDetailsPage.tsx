import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import Hls from 'hls.js';
import { API_BASE } from '../../../config/api';
import DetailsHero from '../../anime/components/details/DetailsHero';
import DetailsInfo from '../../anime/components/details/DetailsInfo';
import type { Anime } from '../../../types/anime';
import { DetailsPageSkeleton } from '../../../pages/AnimeDetailsPage';

interface VaultAnimeDetailsPageProps {
    id: string; // vault-anime:hanime:slug
}

export default function VaultAnimeDetailsPage({ id }: VaultAnimeDetailsPageProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedStream, setSelectedStream] = useState<any>(null);
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);

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
                if (json.success) {
                    setData(json.data);
                    if (json.data.streams && json.data.streams.length > 0) {
                        // Default to highest resolution
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
                setError('Network error');
                setLoading(false);
            });
    }, [id]);

    useEffect(() => {
        if (!selectedStream || !videoRef.current) return;
        const video = videoRef.current;
        const url = selectedStream.url;

        let hls: Hls | null = null;

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
                    video.play().catch(e => console.warn('Playback blocked:', e));
                });
                hls.on(Hls.Events.ERROR, (_event, data) => {
                    console.error('[Vault HLS] Error:', data.type, data.details, data.fatal ? '(FATAL)' : '');
                    if (data.fatal) {
                        console.error('[Vault HLS] Fatal error, attempting recovery...');
                        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                            hls?.startLoad();
                        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                            hls?.recoverMediaError();
                        }
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = proxyUrl;
                video.addEventListener('loadedmetadata', () => {
                    video.play().catch(e => console.warn('Playback blocked:', e));
                });
            }
        } else {
            video.src = url;
            video.play().catch(e => console.warn('Playback blocked:', e));
        }

        return () => {
            if (hls) {
                hls.destroy();
            }
        };
    }, [selectedStream]);

    if (loading) {
        return <DetailsPageSkeleton />;
    }

// ... (in the component)
    if (error || !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-white bg-[#0a0a0a]">
                <p className="text-xl mb-4 text-[#ff3a3a]">{error || 'Failed to load video'}</p>
                <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white underline">Go Back</button>
            </div>
        );
    }

    const fakeAnime = {
        id: data.id || id,
        mal_id: data.id || id,
        title: data.title,
        title_english: data.title,
        images: {
            jpg: {
                large_image_url: data.image || data.poster
            }
        },
        anilist_banner_image: data.poster || data.image,
        type: 'Vault Video',
        score: data.views ? Math.min(9.9, parseFloat((data.views / 100000 + 5.0).toFixed(1))) : undefined, // Fake score from views
        year: data.brand as any,
        episodes: 1,
        synopsis: data.description ? data.description.replace(/<\/?[^>]+(>|$)/g, "") : '',
        genres: data.tags?.map((t: string) => ({ name: t, mal_id: t })) || [],
        status: 'FINISHED',
        rating: data.brand || 'Adult',
    } as unknown as Anime;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#facc15] selection:text-black pb-20">
            <div className="relative pb-24 md:pb-32 lg:pb-40">
                <DetailsHero anime={fakeAnime} />

                <div className="max-w-7xl mx-auto px-8 md:px-14 -mt-24 md:-mt-32 relative z-10">
                    <DetailsInfo
                        anime={fakeAnime}
                        episodesCount={1}
                        isLoading={false}
                        inList={false}
                        inFavorites={false}
                        onWatch={() => {
                            document.getElementById('vault-video-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            videoRef.current?.play().catch(() => {});
                        }}
                        onToggleList={() => {}}
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
