import { m } from 'framer-motion';
import { CLOUDINARY_SHARED_ASSETS } from '../../config/cloudinaryAssets';
import { cardItemVariants } from '../../utils/motion';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
}

export default function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-12 w-12', // Slightly larger for visibility
        md: 'h-24 w-24',
        lg: 'h-32 w-32',
    };

    return (
        <m.div
            variants={cardItemVariants}
            initial="initial"
            animate="animate"
            className="flex flex-col items-center justify-center p-8"
        >
            <m.img
                src={CLOUDINARY_SHARED_ASSETS.luffyGif}
                alt="Loading..."
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                className={`object-contain ${sizeClasses[size]}`}
            />
            {text && <p className="mt-4 text-gray-400 text-sm font-bold animate-pulse">{text}</p>}
        </m.div>
    );
}
