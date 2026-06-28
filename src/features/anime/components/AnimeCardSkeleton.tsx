import React from 'react';
import Skeleton from '../../../components/ui/Skeleton';

interface AnimeCardSkeletonProps {
    className?: string;
}

const AnimeCardSkeleton: React.FC<AnimeCardSkeletonProps> = ({ className = '' }) => {
    return (
        <div className={`relative z-0 ${className}`}>
            {/* Poster Skeleton Wrapper */}
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-3 shadow-lg ring-0 outline-none transition-all duration-75 ease-out">
                <Skeleton className="w-full h-full absolute inset-0 rounded-none" />
                
                {/* Badges Skeletons */}
                <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
                    <Skeleton className="w-[45px] h-[24px] rounded" /> {/* Type badge approx width */}
                    <Skeleton className="w-[38px] h-[24px] rounded" /> {/* Episode badge approx width */}
                </div>
            </div>
            
            {/* Title Skeleton */}
            <div className="space-y-1 mt-1">
                <Skeleton className="w-[90%] h-4 rounded" />
                <Skeleton className="w-[60%] h-4 rounded" />
            </div>
        </div>
    );
};

export default AnimeCardSkeleton;
