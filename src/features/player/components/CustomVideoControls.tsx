import { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Settings, Cast, PictureInPicture2, Maximize, Minimize, Mic, Gauge, Video, Monitor, ChevronLeft, CheckCircle2, Circle } from 'lucide-react';
import type { StreamServerKey } from '../../../hooks/useStreams';
import type { StreamLink } from '../../../types/stream';
import { getMappedQuality } from '../../../utils/streamUtils';

interface CustomVideoControlsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
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
    streamKey?: string;
}

const PLAYBACK_SPEEDS = [0.25, 1, 1.25, 1.5, 2];
const QUALITY_OPTIONS = ['1080P', '720P', '360P'];

export default function CustomVideoControls({
    videoRef,
    onNextEpisode,
    onPrevEpisode,
    hasNextEpisode = false,
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
    streamKey,
}: CustomVideoControlsProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsView, setSettingsView] = useState<'main' | 'speed' | 'quality'>('main');
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [centerAction, setCenterAction] = useState<{ type: 'play' | 'pause'; id: number } | null>(null);

    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentStream = streams[selectedStreamIndex];
    const currentQuality = currentStream ? getMappedQuality(currentStream.quality) : '1080P';
    const hasDub = availableAudios.includes('dub');
    const adjacentHandler = hasNextEpisode ? onNextEpisode : onPrevEpisode;
    const AdjacentIcon = hasNextEpisode ? SkipForward : SkipBack;

    const formatTime = (timeInSeconds: number) => {
        if (isNaN(timeInSeconds)) return '0:00';
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = Math.floor(timeInSeconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleMouseMove = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setShowControls(false);
                setShowSettings(false); // also hide settings menu
                setSettingsView('main');
            }
        }, 3000);
    }, [isPlaying]);

    const handleMouseLeave = useCallback(() => {
        if (isPlaying) {
            setShowControls(false);
            setShowSettings(false); // also hide settings menu
            setSettingsView('main');
        }
    }, [isPlaying]);

    const toggleVideoPlayback = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play().catch(() => undefined);
        } else {
            video.pause();
        }
    }, [videoRef]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const updateTime = () => setCurrentTime(video.currentTime);
        const updateDuration = () => setDuration(video.duration);
        
        // Restore volume and playback state on new video elements
        video.volume = volume;
        video.muted = isMuted;
        video.playbackRate = playbackSpeed;
        
        // This is where the play state and animation trigger happens
        const updatePlayState = () => {
            const isVideoPlaying = !video.paused;
            setIsPlaying(isVideoPlaying);
            setCenterAction({ type: isVideoPlaying ? 'play' : 'pause', id: Date.now() });
        };
        
        const updateVolume = () => {
            setVolume(video.volume);
            setIsMuted(video.muted);
        };

        video.addEventListener('timeupdate', updateTime);
        video.addEventListener('loadedmetadata', updateDuration);
        video.addEventListener('play', updatePlayState);
        video.addEventListener('pause', updatePlayState);
        video.addEventListener('volumechange', updateVolume);

        return () => {
            video.removeEventListener('timeupdate', updateTime);
            video.removeEventListener('loadedmetadata', updateDuration);
            video.removeEventListener('play', updatePlayState);
            video.removeEventListener('pause', updatePlayState);
            video.removeEventListener('volumechange', updateVolume);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoRef, playbackSpeed, streamKey]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const togglePlay = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        toggleVideoPlayback();
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
        }
    };

    const setVideoPlaybackSpeed = (speed: number) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
        setPlaybackSpeed(speed);
        setSettingsView('main');
    };

    const handleQualitySelect = (quality: string) => {
        const index = streams.findIndex((stream) => getMappedQuality(stream.quality) === quality);
        if (index >= 0) {
            onQualityChange(index);
        } else {
            onSetAutoQuality();
        }
        setSettingsView('main');
    };

    const toggleFullscreen = () => {
        const playerContainer = videoRef.current?.closest('.watch-player-shell');
        if (!playerContainer) return;

        if (!document.fullscreenElement) {
            playerContainer.requestFullscreen().catch(console.error);
        } else {
            document.exitFullscreen().catch(console.error);
        }
    };

    const togglePiP = async () => {
        if (videoRef.current) {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await videoRef.current.requestPictureInPicture();
            }
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const progressPercentage = duration ? (currentTime / duration) * 100 : 0;

    useEffect(() => {
        const playerShell = videoRef.current?.closest('.watch-player-shell') as HTMLElement;
        if (playerShell) {
            playerShell.tabIndex = 0;
            playerShell.addEventListener('mousemove', handleMouseMove);
            playerShell.addEventListener('mouseleave', handleMouseLeave);
            const focusPlayer = () => playerShell.focus({ preventScroll: true });
            const handleKeyDown = (event: KeyboardEvent) => {
                if (event.code !== 'Space') return;

                const target = event.target as HTMLElement | null;
                const targetTag = target?.tagName?.toLowerCase();
                const isEditableTarget = Boolean(
                    target?.isContentEditable ||
                    targetTag === 'input' ||
                    targetTag === 'textarea' ||
                    targetTag === 'select' ||
                    targetTag === 'button'
                );
                const activeElement = document.activeElement;
                const playerIsActive = Boolean(
                    document.fullscreenElement?.contains(playerShell) ||
                    (activeElement && playerShell.contains(activeElement))
                );

                if (isEditableTarget || !playerIsActive) return;
                event.preventDefault();
                toggleVideoPlayback();
                handleMouseMove();
            };
            playerShell.addEventListener('pointerdown', focusPlayer);
            playerShell.addEventListener('keydown', handleKeyDown);
            
            const initialTimer = setTimeout(handleMouseMove, 0);
            
            return () => {
                clearTimeout(initialTimer);
                playerShell.removeEventListener('mousemove', handleMouseMove);
                playerShell.removeEventListener('mouseleave', handleMouseLeave);
                playerShell.removeEventListener('pointerdown', focusPlayer);
                playerShell.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [videoRef, handleMouseMove, handleMouseLeave, toggleVideoPlayback]);

    // Cleanup the center animation state so it fully unmounts
    useEffect(() => {
        if (centerAction) {
            const timer = setTimeout(() => {
                setCenterAction(null);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [centerAction]);

    return (
        <>
            <style>{`
                @keyframes animetsu-center-pop {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.62); }
                    14% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    52% { opacity: 0.82; transform: translate(-50%, -50%) scale(1.18); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.72); }
                }
                .animate-animetsu-center-pop {
                    animation: animetsu-center-pop 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
            
            {/* Center Animation Overlay */}
            {centerAction && (
                <div 
                    key={centerAction.id}
                    className="watch-center-pop absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[60] flex h-16 w-16 items-center justify-center rounded-full bg-[#2A2322]/75 shadow-2xl animate-animetsu-center-pop sm:h-[72px] sm:w-[72px]"
                >
                    {centerAction.type === 'play' ? (
                        <Play className="w-8 h-8 text-white fill-current ml-1 sm:h-9 sm:w-9" />
                    ) : (
                        <Pause className="w-8 h-8 text-white fill-current sm:h-9 sm:w-9" />
                    )}
                </div>
            )}

            <div 
                className={`absolute bottom-0 left-0 right-0 p-4 sm:p-6 transition-opacity duration-300 z-[2147483647] pointer-events-none ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
            >
                <div className="mx-auto max-w-5xl flex flex-col gap-4 pointer-events-auto">
                    {/* Scrubber / Progress Bar */}
                    <div className="relative h-1 w-full bg-white/20 cursor-pointer group rounded-full">
                        <div 
                            className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-150 ease-out"
                            style={{ width: `${progressPercentage}%` }}
                        />
                        <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        {/* Hover thumb */}
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow"
                            style={{ left: `calc(${progressPercentage}% - 6px)` }}
                        />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between">
                        {/* Left Controls */}
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={togglePlay} 
                                className="bg-[#2A2322]/90 backdrop-blur-md rounded-full w-12 h-10 flex items-center justify-center text-white hover:bg-white/20 border border-white/5 transition-colors shadow-lg"
                            >
                                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                            </button>
                            
                            {adjacentHandler && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); adjacentHandler(); }}
                                    title={hasNextEpisode ? 'Next Episode' : 'Previous Episode'}
                                    className="bg-[#2A2322]/90 backdrop-blur-md rounded-full w-12 h-10 flex items-center justify-center text-white hover:bg-white/20 border border-white/5 transition-colors shadow-lg"
                                >
                                    <AdjacentIcon className="w-5 h-5 fill-current" />
                                </button>
                            )}
                            
                            <div className="group/volume flex items-center bg-[#2A2322]/90 backdrop-blur-md rounded-full h-10 text-white hover:bg-white/10 border border-white/5 transition-all duration-300 shadow-lg overflow-hidden w-12 hover:w-32">
                                <button 
                                    onClick={toggleMute} 
                                    className="w-12 h-10 flex-shrink-0 flex items-center justify-center"
                                >
                                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                </button>
                                <input 
                                    type="range" 
                                    min={0} 
                                    max={1} 
                                    step={0.01} 
                                    value={isMuted ? 0 : volume} 
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (videoRef.current) {
                                            videoRef.current.volume = val;
                                            videoRef.current.muted = val === 0;
                                        }
                                    }}
                                    className="w-16 h-1 rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                                    style={{ background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(isMuted ? 0 : volume) * 100}%)` }}
                                />
                            </div>

                            <div className="bg-[#2A2322]/90 backdrop-blur-md rounded-full px-4 h-10 flex items-center justify-center text-white text-xs font-medium tracking-wider border border-white/5 shadow-lg">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </div>
                        </div>

                        {/* Right Controls */}
                        <div className="flex items-center gap-1 bg-[#2A2322]/90 backdrop-blur-md rounded-full px-3 h-10 border border-white/5 shadow-lg relative">
                            {/* Settings Popover */}
                            {showSettings && (
                                <div className="absolute bottom-full right-0 mb-4 w-72 bg-[#1A1A1A]/95 backdrop-blur-xl rounded-2xl p-2 shadow-2xl border border-white/10 z-50">
                                    {settingsView !== 'main' && (
                                        <button
                                            onClick={() => setSettingsView('main')}
                                            className="mb-2 flex w-full items-center gap-2 border-b border-white/10 px-2 pb-3 pt-1 text-left text-sm font-semibold text-white"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            {settingsView === 'quality' ? 'Quality' : 'Playback speed'}
                                        </button>
                                    )}

                                    {settingsView === 'main' && (
                                        <div className="flex flex-col">
                                            <button
                                                onClick={() => hasDub && onAudioChange(selectedAudio === 'dub' ? 'sub' : 'dub')}
                                                disabled={!hasDub}
                                                className="flex items-center justify-between w-full p-3 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-40"
                                            >
                                                <div className="flex items-center gap-3 text-white">
                                                    <Mic className="w-5 h-5" />
                                                    <span className="text-sm font-medium">Dub</span>
                                                </div>
                                                <div className={`w-9 h-5 rounded-full relative shadow-inner transition-colors ${selectedAudio === 'dub' ? 'bg-white' : 'bg-white/20'}`}>
                                                    <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${selectedAudio === 'dub' ? 'bg-black left-5' : 'bg-white left-1'}`}></div>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => setSettingsView('speed')}
                                                className="flex items-center justify-between w-full p-3 hover:bg-white/10 rounded-xl transition-colors"
                                            >
                                                <div className="flex items-center gap-3 text-white">
                                                    <Gauge className="w-5 h-5" />
                                                    <span className="text-sm font-medium">Playback speed</span>
                                                </div>
                                                <span className="text-xs text-white/70">{playbackSpeed}x</span>
                                            </button>
                                            <button
                                                onClick={() => setSettingsView('quality')}
                                                className="flex items-center justify-between w-full p-3 hover:bg-white/10 rounded-xl transition-colors"
                                            >
                                                <div className="flex items-center gap-3 text-white">
                                                    <Video className="w-5 h-5" />
                                                    <span className="text-sm font-medium">Quality</span>
                                                </div>
                                                <span className="text-xs text-white/70">{isAutoQuality ? `Auto(${currentQuality})` : currentQuality}</span>
                                            </button>
                                            <button
                                                onClick={() => onServerChange('auto')}
                                                className="flex items-center justify-between w-full p-3 hover:bg-white/10 rounded-xl transition-colors"
                                            >
                                                <div className="flex items-center gap-3 text-white">
                                                    <Monitor className="w-5 h-5" />
                                                    <span className="text-sm font-medium">Server</span>
                                                </div>
                                                <span className="text-xs text-white/70">{selectedServer === 'auto' ? 'Default' : selectedServer}</span>
                                            </button>
                                        </div>
                                    )}

                                    {settingsView === 'speed' && (
                                        <div className="flex flex-col gap-1">
                                            {PLAYBACK_SPEEDS.map((speed) => (
                                                <button
                                                    key={speed}
                                                    onClick={() => setVideoPlaybackSpeed(speed)}
                                                    className={`flex w-full items-center justify-between rounded-xl p-3 text-left transition-colors ${playbackSpeed === speed ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10'}`}
                                                >
                                                    <span className="text-sm font-medium">{speed}x</span>
                                                    {playbackSpeed === speed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {settingsView === 'quality' && (
                                        <div className="flex flex-col gap-1">
                                            {QUALITY_OPTIONS.map((quality) => {
                                                const streamIndex = streams.findIndex((stream) => getMappedQuality(stream.quality) === quality);
                                                const isAvailable = streamIndex >= 0;
                                                const isSelected = !isAutoQuality && currentQuality === quality;
                                                return (
                                                    <button
                                                        key={quality}
                                                        onClick={() => handleQualitySelect(quality)}
                                                        disabled={!isAvailable}
                                                        className={`flex w-full items-center justify-between rounded-xl p-3 text-left transition-colors disabled:opacity-40 ${isSelected ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10'}`}
                                                    >
                                                        <span className="text-sm font-medium">{quality.replace('P', 'p')}</span>
                                                        {isSelected ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            <button onClick={() => { setShowSettings(!showSettings); setSettingsView('main'); }} className="text-white hover:text-white/80 transition-colors p-2 rounded-full hover:bg-white/10">
                                <Settings className="w-5 h-5" />
                            </button>
                            <button className="text-white hover:text-white/80 transition-colors p-2 rounded-full hover:bg-white/10 hidden sm:block">
                                <Cast className="w-5 h-5" />
                            </button>
                            <button onClick={togglePiP} className="text-white hover:text-white/80 transition-colors p-2 rounded-full hover:bg-white/10 hidden sm:block">
                                <PictureInPicture2 className="w-5 h-5" />
                            </button>
                            <button onClick={toggleFullscreen} className="text-white hover:text-white/80 transition-colors p-2 rounded-full hover:bg-white/10">
                                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
