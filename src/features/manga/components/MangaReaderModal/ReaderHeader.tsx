import { ZoomIn, ZoomOut } from 'lucide-react';
import type { MangaChapter } from '../../../../types/manga';

interface ReaderHeaderProps {
    mangaTitle: string;
    mangaImage: string;
    currentChapter: MangaChapter | null;
    zoomLevel: number;
    isVisible: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
}

export default function ReaderHeader({
    mangaTitle,
    mangaImage,
    currentChapter,
    zoomLevel,
    isVisible,
    onZoomIn,
    onZoomOut,
}: ReaderHeaderProps) {
    return (
        <header className={`h-20 shrink-0 bg-[#0a0a0a]/90 backdrop-blur-md z-50 transition-transform duration-300 absolute top-0 left-0 right-0 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="w-full h-full max-w-7xl mx-auto px-8 md:px-14 flex items-center justify-between gap-2">
                {/* LEFT: Nav & Title */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Back button removed per user request */}

                    {mangaImage && (
                        <img 
                            src={mangaImage} 
                            alt="cover" 
                            className="w-10 h-14 object-cover rounded shadow-sm hidden sm:block"
                        />
                    )}

                    <div className="flex flex-col min-w-0">
                        <h1 className="text-sm font-semibold text-gray-400 truncate hidden sm:block">
                            {mangaTitle}
                        </h1>
                        <span className="text-base md:text-lg font-bold text-white truncate leading-tight">
                            {currentChapter ? currentChapter.title : mangaTitle}
                        </span>
                    </div>
                </div>

                {/* CENTER: Zoom Controls */}
                <div className="flex-1 flex justify-center hidden sm:flex">
                    <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
                        <button onClick={onZoomOut} className="p-1.5 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition-colors">
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono font-bold w-12 text-center text-gray-300">{zoomLevel}%</span>
                        <button onClick={onZoomIn} className="p-1.5 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition-colors">
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* RIGHT: Controls (Removed per user request) */}
                <div className="flex items-center justify-end gap-2 flex-1 shrink-0">
                </div>
            </div>
        </header>
    );
}
