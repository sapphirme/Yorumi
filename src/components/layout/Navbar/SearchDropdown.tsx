
import { AnimatePresence, m } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { getDisplayImageUrl } from '../../../utils/image';
import { dropdownVariants, listContainerVariants, cardItemVariants, pressMotion } from '../../../utils/motion';

interface SearchResultItem {
    id: number | string;
    title: string;
    subtitle: string;
    image: string;
    date?: string;
    type?: string;
    duration?: string;
    url: string;
}

interface SearchDropdownProps {
    results: SearchResultItem[];
    isVisible: boolean;
    onSelect: (item: SearchResultItem) => void;
    onViewAll: () => void;
    isLoading?: boolean;
    theme?: 'anime' | 'manga';
}

export default function SearchDropdown({
    results,
    isVisible,
    onSelect,
    onViewAll,
    isLoading,
    theme = 'anime'
}: SearchDropdownProps) {
    // Use specific colors from the screenshot approximation
    // Background seems to be a dark blueish-purple or just dark theme default
    // The "View all results" button is pink: #ffb7e0 (approximate from screenshot or yorumi-accent?)
    // Actually yorumi-accent in Navbar is varying. Let's use a hardcoded pink for now to match screenshot if yorumi-accent isn't it.
    // Screenshot pink: Light pink/lavender.

    const isManga = theme === 'manga';
    const containerBg = isManga ? 'bg-[#1a1230]' : 'bg-[#111827]';
    const hoverBg = isManga ? 'hover:bg-[#24193f]' : 'hover:bg-white/5';
    const ctaBg = isManga ? 'bg-yorumi-manga hover:bg-yorumi-manga/90' : 'bg-yorumi-accent hover:bg-yorumi-accent/90';
    const ctaText = isManga ? 'text-white' : 'text-[#150F26]';
    const fallbackImage = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 96 128%22%3E%3Crect width=%2296%22 height=%22128%22 fill=%22%23172233%22/%3E%3Cpath d=%22M32 52h32v24H32z%22 fill=%22%232b3a51%22/%3E%3Cpath d=%22M38 60l7 8 6-6 9 12H36z%22 fill=%22%235c708f%22/%3E%3C/svg%3E';

    return (
        <AnimatePresence>
            {isVisible && (
        <m.div
            variants={dropdownVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`absolute top-full left-0 right-0 mt-2 ${containerBg} rounded-lg overflow-hidden shadow-2xl z-50 border border-white/5 font-sans origin-top`}
        >
            {results.length > 0 ? (
                <>
                    <m.div className="max-h-[70vh] overflow-y-auto" variants={listContainerVariants} initial="initial" animate="animate">
                        {results.map((item) => (
                            <m.div
                                key={item.id}
                                variants={cardItemVariants}
                                whileTap={pressMotion}
                                onClick={() => onSelect(item)}
                                className={`group flex items-center gap-4 p-3 ${hoverBg} cursor-pointer transition-colors border-b border-white/5 last:border-b-0`}
                            >
                                {/* Image */}
                                <div className="w-12 h-16 shrink-0 rounded overflow-hidden relative">
                                    <img
                                        src={getDisplayImageUrl(item.image) || fallbackImage}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                        onError={(event) => {
                                            if (event.currentTarget.src !== fallbackImage) {
                                                event.currentTarget.src = fallbackImage;
                                            }
                                        }}
                                    />
                                </div>

                                {/* Text Content */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-bold text-sm truncate leading-tight mb-0.5">
                                        {item.title}
                                    </h4>
                                    <div className="text-gray-400 text-xs truncate mb-1">
                                        {item.subtitle}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium tracking-wide">
                                        {item.date && <span>{item.date}</span>}
                                        {item.date && item.type && <span className="w-1 h-1 rounded-full bg-gray-600" />}
                                        {item.type && <span>{item.type}</span>}
                                        {item.type && item.duration && <span className="w-1 h-1 rounded-full bg-gray-600" />}
                                        {item.duration && <span>{item.duration}</span>}
                                    </div>
                                </div>
                            </m.div>
                        ))}
                    </m.div>

                    {/* View All Button */}
                    <m.div
                        onClick={onViewAll}
                        whileTap={pressMotion}
                        className={`${ctaBg} p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors`}
                    >
                        <span className={`${ctaText} font-bold text-sm uppercase tracking-wide`}>
                            View all results
                        </span>
                        <ChevronRight className={`w-4 h-4 ${ctaText}`} />
                    </m.div>
                </>
            ) : isLoading ? (
                <div className="p-4 text-center text-gray-400 text-sm">Searching...</div>
            ) : (
                <div className="p-4 text-center text-gray-400 text-sm">
                    No results found
                </div>
            )}
        </m.div>
            )}
        </AnimatePresence>
    );
}
