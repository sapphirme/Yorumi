import React from 'react';

const SpotlightSkeleton: React.FC = () => {
    return (
        <div className="relative w-full h-[50vh] md:h-[60vh] min-h-[400px] md:min-h-[480px] group bg-[#0a0a0a] overflow-hidden mb-8">
            {/* Background Shimmer */}
            <div className="absolute inset-0 z-0">
                <div className="absolute right-0 top-0 w-full md:w-[70%] h-full bg-gradient-to-r from-gray-800/50 to-gray-700/50 animate-pulse" />
                <div className="absolute inset-0 bg-black/60 md:bg-black/40 z-0" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/60 to-[#0a0a0a] z-0" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent pointer-events-none z-0" />
            </div>

            {/* Fixed Overlay Content */}
            <div className="absolute inset-0 flex flex-col md:flex-row gap-12 items-center w-full max-w-7xl mx-auto px-8 md:px-14 mt-12 z-10">
                {/* Text Info (Left) */}
                <div className="flex-1 w-full max-w-2xl flex flex-col justify-end h-[360px] md:h-[380px]">
                    {/* Top Section: Mobile Cover & Title */}
                    <div className="w-full mb-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="md:hidden h-24 w-16 rounded-md overflow-hidden bg-gray-700/50 animate-pulse border border-white/10" />
                        </div>
                        <div className="flex items-start">
                            <div className="h-16 md:h-20 w-[80%] bg-gradient-to-r from-gray-700/50 to-gray-600/50 rounded animate-pulse" />
                        </div>
                    </div>

                    {/* Middle Section: Chips */}
                    <div className="w-full flex items-center flex-wrap gap-4 select-none mb-4">
                        <div className="h-8 w-16 bg-white/10 rounded-lg animate-pulse" />
                        <div className="h-8 w-16 bg-[#22c55e]/50 rounded-lg animate-pulse" />
                        <div className="h-8 w-20 bg-yorumi-accent/20 border border-yorumi-accent/50 rounded-lg animate-pulse" />
                    </div>

                    {/* Bottom Section: Synopsis & Buttons */}
                    <div className="w-full mb-6 space-y-2">
                        <div className="h-4 w-[90%] bg-gray-700/40 rounded animate-pulse" />
                        <div className="h-4 w-[90%] bg-gray-700/40 rounded animate-pulse" />
                        <div className="h-4 w-[60%] bg-gray-700/40 rounded animate-pulse" />
                    </div>

                    <div className="w-full flex gap-4">
                        <div className="h-10 md:h-11 w-32 md:w-36 bg-yorumi-accent/30 rounded-lg animate-pulse" />
                        <div className="h-10 md:h-11 w-28 md:w-32 bg-white/10 border border-white/20 rounded-lg animate-pulse" />
                    </div>
                </div>

                {/* Coverflow Images (Right - Portrait) */}
                <div className="ml-auto lg:mr-12 xl:mr-20 relative w-56 lg:w-64 h-[336px] lg:h-[384px]">
                    <div className="absolute inset-0">
                        <div className="w-full h-full rounded-xl overflow-hidden border border-white/10 bg-gradient-to-b from-gray-700/50 to-gray-800/50 animate-pulse shadow-[0_0_40px_rgba(0,0,0,0.6)]" />
                    </div>
                </div>
            </div>

            {/* Navigation Dots Skeleton */}
            <div className="absolute z-20 flex gap-2 right-4 top-1/2 -translate-y-1/2 flex-col md:flex-row md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:top-auto md:right-auto md:translate-y-0">
                {[...Array(5)].map((_, idx) => (
                    <div
                        key={idx}
                        className={`rounded-full bg-white/30 animate-pulse ${idx === 0 ? 'w-2 h-2 md:w-6 md:h-2' : 'w-2 h-2'}`}
                        style={{ animationDelay: `${idx * 100}ms` }}
                    />
                ))}
            </div>

            {/* Shimmer Effect Overlay */}
            <div className="absolute inset-0 z-[5] pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            </div>
        </div>
    );
};

export default SpotlightSkeleton;
