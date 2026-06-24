import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Carousel from '../components/ui/Carousel';
import ContinueWatching from '../features/anime/components/ContinueWatching';
import MangaContinueReading from '../features/manga/components/MangaContinueReading';
import { useContinueReading } from '../hooks/useContinueReading';
import { useContinueWatching } from '../hooks/useContinueWatching';
import { useReadList } from '../hooks/useReadList';
import { useWatchList } from '../hooks/useWatchList';
import { slugify } from '../utils/slugify';
import type { WatchListItem } from '../utils/storage';

const getAnimeRouteId = (item: WatchListItem) => {
    const scraperId = item.scraperId;
    if (scraperId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scraperId.replace(/^s:/, ''))) {
        return `s:${scraperId.replace(/^s:/, '')}`;
    }
    return String(item.anilistId || item.id);
};

export default function LibraryPage() {
    const { continueWatchingList, removeFromHistory: removeWatchingHistory } = useContinueWatching();
    const { continueReadingList, removeFromHistory: removeReadingHistory } = useContinueReading();
    const { watchList, removeFromWatchList } = useWatchList();
    const { readList, removeFromReadList } = useReadList();
    const navigate = useNavigate();

    const hasContent = continueWatchingList.length > 0 || continueReadingList.length > 0 || watchList.length > 0 || readList.length > 0;

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-12 pb-24">
            <div className="w-full max-w-7xl mx-auto px-8 md:px-14 relative">
                <div className="mb-8">
                    <h1 className="mb-2 text-2xl font-bold uppercase tracking-wider text-white">MY LIBRARY</h1>
                    <p className="text-sm text-gray-400">Watch history, progress, and saved titles</p>
                </div>

                <div className="space-y-8 pb-12">
                    {!hasContent && (
                        <div className="flex flex-col items-center justify-center py-24 rounded-lg border border-dashed border-white/10 text-gray-500 bg-white/5">
                            <p>Your library is empty. Start exploring to save items here!</p>
                        </div>
                    )}

                    <ContinueWatching
                        title={`Continue Watching (${continueWatchingList.length})`}
                        items={continueWatchingList}
                        onRemove={removeWatchingHistory}
                        onWatchClick={(anime, episodeNumber, startSeconds) => {
                            const title = slugify(anime.title || 'anime');
                            const routeId = anime.scraperId || anime.id || anime.mal_id;
                            const resume = Number.isFinite(startSeconds) ? Math.max(0, Math.floor(startSeconds || 0)) : 0;
                            navigate(`/anime/details/${routeId}?ep=${episodeNumber}${resume > 0 ? `&t=${resume}` : ''}`);
                        }}
                    />

                    <MangaContinueReading
                        title={`Continue Reading (${continueReadingList.length})`}
                        items={continueReadingList}
                        onRemove={removeReadingHistory}
                        onReadClick={(mangaId, mangaTitle, chapterNumber) => {
                            const title = slugify(mangaTitle || 'manga');
                            navigate(`/manga/read/${title}/${mangaId}/c${chapterNumber}`);
                        }}
                    />

                    {watchList.length > 0 && (
                        <Carousel title={`Watchlist (${watchList.length})`} variant="portrait">
                            {watchList.map((item) => (
                                <div
                                    key={item.id}
                                    className="relative group h-full cursor-pointer"
                                    onClick={() => {
                                        const routeId = getAnimeRouteId(item);
                                        navigate(`/anime/details/${routeId}`);
                                    }}
                                >
                                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                        {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center" />
                                        <button
                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFromWatchList(item.id);
                                            }}
                                            title="Remove from watchlist"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="px-1">
                                        <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-yorumi-accent transition-colors">{item.title}</h4>
                                    </div>
                                </div>
                            ))}
                        </Carousel>
                    )}

                    {readList.length > 0 && (
                        <Carousel title={`Readlist (${readList.length})`} variant="portrait">
                            {readList.map((item) => (
                                <div
                                    key={item.id}
                                    className="relative group h-full cursor-pointer"
                                    onClick={() => navigate(`/manga/details/${item.id}`)}
                                >
                                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 shadow-lg border border-white/5 transition-colors cursor-pointer">
                                        {item.image && <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center" />
                                        <button
                                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur hover:bg-red-500/80 text-white/80 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFromReadList(item.id);
                                            }}
                                            title="Remove from readlist"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="px-1">
                                        <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-yorumi-manga transition-colors">{item.title}</h4>
                                    </div>
                                </div>
                            ))}
                        </Carousel>
                    )}
                </div>
            </div>
        </div>
    );
}
