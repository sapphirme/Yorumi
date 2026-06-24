import { ChevronLeft, ChevronRight, Menu, ChevronDown } from 'lucide-react';
import type { MangaChapter } from '../../../../types/manga';
import { useMemo, useEffect, useRef } from 'react';

interface ReaderFooterProps {
    chapters: MangaChapter[];
    currentChapter: MangaChapter | null;
    prevChapter: MangaChapter | null;
    nextChapter: MangaChapter | null;
    isVisible: boolean;
    showChapters: boolean;
    readChapters: Set<string>;
    onLoadChapter: (chapter: MangaChapter) => void;
    onToggleChapters: () => void;
}

export default function ReaderFooter({
    chapters,
    currentChapter,
    prevChapter,
    nextChapter,
    isVisible,
    showChapters,
    readChapters,
    onLoadChapter,
    onToggleChapters
}: ReaderFooterProps) {
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Scroll to active chapter when dropdown opens
    useEffect(() => {
        if (showChapters && currentChapter && dropdownRef.current) {
            // Small timeout to ensure the dropdown is rendered
            setTimeout(() => {
                const activeEl = dropdownRef.current?.querySelector(`[data-chapter-id="${currentChapter.id}"]`);
                if (activeEl) {
                    activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }, 50);
        }
    }, [showChapters, currentChapter]);

    const getChapterText = (title: string) => {
        const match = title.match(/Chapter\s+(\d+[.]?\d*)/i);
        return match ? `Chapter ${match[1]}` : title;
    };

    // Strict descending order (highest chapter number first)
    const sortedChapters = useMemo(() => {
        return [...chapters].sort((a, b) => {
            const numA = parseFloat(a.title.match(/Chapter\s+(\d+[.]?\d*)/i)?.[1] || '0');
            const numB = parseFloat(b.title.match(/Chapter\s+(\d+[.]?\d*)/i)?.[1] || '0');
            return numB - numA;
        });
    }, [chapters]);

    return (
        <footer className={`h-20 shrink-0 bg-[#0a0a0a]/90 backdrop-blur-md z-50 transition-transform duration-300 absolute bottom-0 left-0 right-0 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="w-full h-full max-w-7xl mx-auto px-8 md:px-14 flex items-center justify-between">
                {/* LEFT: Prev Chapter */}
                <div className="flex-1 flex justify-start">
                    <button
                        onClick={() => prevChapter && onLoadChapter(prevChapter)}
                        disabled={!prevChapter}
                        className="h-10 px-4 md:px-6 bg-[#1a1a1a] border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-2 rounded-xl transition-colors font-bold text-sm"
                        title="Previous Chapter"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Prev</span>
                    </button>
                </div>

                {/* CENTER: Chapter Selector */}
                <div className="flex-1 flex justify-center relative">
                    {/* Popover Dropdown */}
                    {showChapters && isVisible && (
                        <div className="absolute bottom-full mb-4 w-64 max-h-[300px] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col z-[100]">
                            <div ref={dropdownRef} className="overflow-y-auto p-2 space-y-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                                {sortedChapters.map((chapter) => {
                                    const isCurrent = currentChapter?.id === chapter.id;
                                    const isRead = readChapters.has(chapter.id);
                                    return (
                                        <button
                                            key={chapter.id}
                                            data-chapter-id={chapter.id}
                                            onClick={() => {
                                                onLoadChapter(chapter);
                                                onToggleChapters();
                                            }}
                                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                                                isCurrent 
                                                    ? 'bg-[#8b5cf6]/20 text-[#8b5cf6]' 
                                                    : isRead
                                                        ? 'text-gray-500 hover:bg-white/5 hover:text-white'
                                                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                            }`}
                                        >
                                            {getChapterText(chapter.title)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onToggleChapters}
                        className="h-10 px-4 md:px-6 bg-white/5 hover:bg-white/10 text-white flex items-center gap-2 rounded-xl transition-colors font-bold text-sm border border-white/10"
                    >
                        <Menu className="w-4 h-4" />
                        <span className="truncate">
                            {currentChapter ? getChapterText(currentChapter.title) : 'Select Chapter'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showChapters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* RIGHT: Next Chapter */}
                <div className="flex-1 flex justify-end">
                    <button
                        onClick={() => nextChapter && onLoadChapter(nextChapter)}
                        disabled={!nextChapter}
                        className="h-10 px-4 md:px-6 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white disabled:opacity-50 disabled:hover:bg-[#8b5cf6] flex items-center gap-2 rounded-xl transition-colors font-bold text-sm shadow-lg shadow-[#8b5cf6]/20"
                        title="Next Chapter"
                    >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </footer>
    );
}
