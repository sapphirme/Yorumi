import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export default function ScrollRestoration() {
    const location = useLocation();
    const navigationType = useNavigationType();
    const scrollPositions = useRef<Record<string, number>>({});

    useEffect(() => {
        // Handle scroll restoration
        if (navigationType === 'POP') {
            // Give the browser and React a tiny tick to paint DOM before scrolling
            requestAnimationFrame(() => {
                const savedPosition = scrollPositions.current[location.key];
                if (savedPosition !== undefined) {
                    window.scrollTo(0, savedPosition);
                }
            });
        }
    }, [location.key, navigationType]);

    useEffect(() => {
        // Save scroll position on unmount / before navigating away
        const handleScroll = () => {
            scrollPositions.current[location.key] = window.scrollY;
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [location.key]);

    return null;
}
