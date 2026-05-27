import React from 'react';
import { m } from 'framer-motion';

interface SkeletonProps {
    className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
    return (
        <m.div
            initial={{ opacity: 0.45 }}
            animate={{ opacity: [0.45, 0.85, 0.45] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className={`bg-white/5 rounded-md ${className}`}
        />
    );
};

export default Skeleton;
