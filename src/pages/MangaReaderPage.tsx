import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useManga } from '../hooks/useManga';
import { slugify } from '../utils/slugify';
import MangaReaderModal from '../features/manga/components/MangaReaderModal';
import type { MangaChapter } from '../types/manga';

export default function MangaReaderPage() {
    const { id, chapter } = useParams<{ title: string; id: string; chapter: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const routeManga = location.state?.manga;

    const {
        selectedManga,
        mangaChapters,
        currentMangaChapter,
        chapterPages,
        mangaChaptersLoading,
        mangaPagesLoading,
        chapterSearchQuery,
        zoomLevel,
        mangaLoading,
        setChapterSearchQuery,
        fetchMangaDetails,
        loadMangaChapter,
        prefetchChapter,
        zoomIn,
        zoomOut,
        readChapters
    } = useManga();

    // Fetch manga details on mount
    useEffect(() => {
        if (id) {
            fetchMangaDetails(id, routeManga);
        }
    }, [id, routeManga, fetchMangaDetails]);

    // Auto-load chapter when chapters are available
    useEffect(() => {
        if (mangaChapters.length > 0 && chapter && !currentMangaChapter) {
            // Find chapter by number (chapter param is like "c4" from URL, strip the 'c' prefix)
            const chapterNumStr = chapter.startsWith('c') ? chapter.slice(1) : chapter;
            const chapterNum = parseInt(chapterNumStr);
            const targetChapter = mangaChapters.find(ch => {
                const match = ch.title.match(/Chapter\s+(\d+)/i);
                return match && parseInt(match[1]) === chapterNum;
            });

            if (targetChapter) {
                loadMangaChapter(targetChapter);
            } else if (mangaChapters.length > 0) {
                // Fallback: load first chapter if target not found
                console.warn(`Chapter ${chapter} not found, loading first available`);
                loadMangaChapter(mangaChapters[mangaChapters.length - 1]);
            }
        }
    }, [mangaChapters, chapter, currentMangaChapter, loadMangaChapter]);

    // Handle chapter navigation - update URL
    const handleLoadChapter = (ch: MangaChapter) => {
        if (selectedManga) {
            const title = slugify(selectedManga.title || 'manga');
            const chapterMatch = ch.title.match(/Chapter\s+(\d+)/i);
            const chapterNum = chapterMatch ? chapterMatch[1] : '1';
            navigate(`/manga/read/${title}/${id}/c${chapterNum}`, { replace: true, state: { manga: selectedManga } });
        }
        loadMangaChapter(ch);
    };

    // Handle close - go back to details
    const handleClose = () => {
        if (window.history.length > 2) {
            navigate(-1);
        } else if (id) {
            navigate(`/manga/details/${id}`, { replace: true, state: { manga: selectedManga } });
        } else {
            navigate('/manga', { replace: true });
        }
    };

    // Show loading while manga or chapters are loading
    if (mangaLoading || mangaChaptersLoading) {
        return (
            <div className="fixed inset-0 z-[130] md:z-[90] flex items-center justify-center bg-black/95 backdrop-blur-md">
                <div className="w-12 h-12 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
            </div>
        );
    }

    if (!selectedManga) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white gap-4">
                <div className="text-6xl font-black text-white/10">!</div>
                <h1 className="text-2xl font-bold">Manga Not Found</h1>
                <p className="text-gray-400">We couldn't load the details for this manga.</p>
                <button
                    onClick={() => navigate('/manga')}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-colors mt-4"
                >
                    Go to Search
                </button>
            </div>
        );
    }

    // Show loading while waiting for chapter to load
    if (!currentMangaChapter && mangaChapters.length > 0) {
        return (
            <div className="fixed inset-0 z-[130] md:z-[90] flex items-center justify-center bg-black/95 backdrop-blur-md">
                <div className="w-12 h-12 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
            </div>
        );
    }

    // Handle case where no chapters exist
    if (mangaChapters.length === 0) {
        const sourceName = selectedManga?.scraper_id?.toString().startsWith('vault:') ? 'Toonily' : 'MangaKatana';
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white gap-4">
                <div className="text-6xl font-black text-white/10">!</div>
                <h1 className="text-2xl font-bold">No Chapters Available</h1>
                <p className="text-gray-400">This manga doesn't have any readable chapters available on {sourceName}.</p>
                <button
                    onClick={() => navigate(`/manga/details/${id}`)}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-colors mt-4"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <MangaReaderModal
            isOpen={true}
            onClose={handleClose}
            manga={selectedManga}
            chapters={mangaChapters}
            currentChapter={currentMangaChapter}
            pages={chapterPages}
            chapterSearchQuery={chapterSearchQuery}
            chaptersLoading={mangaChaptersLoading}
            pagesLoading={mangaPagesLoading}
            zoomLevel={zoomLevel}
            onChapterSearchChange={setChapterSearchQuery}
            onLoadChapter={handleLoadChapter}
            onPrefetchChapter={prefetchChapter}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            readChapters={readChapters}
        />
    );
}
