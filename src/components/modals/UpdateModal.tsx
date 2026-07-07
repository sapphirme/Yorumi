import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Code2, Bug, Zap } from 'lucide-react';

const CURRENT_VERSION = '3.5.3';

export default function UpdateModal() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const lastVersion = localStorage.getItem('yorumi_last_version');
        if (lastVersion !== CURRENT_VERSION) {
            // Slight delay to not interrupt initial render
            const timer = setTimeout(() => setIsOpen(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem('yorumi_last_version', CURRENT_VERSION);
        setIsOpen(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-yorumi-bg border border-white/10 shadow-2xl"
                    >
                        {/* Header Image / Gradient */}
                        <div className="relative h-32 w-full bg-gradient-to-br from-yorumi-accent/80 via-[#9c4dcc]/60 to-yorumi-bg overflow-hidden flex items-center justify-center">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                            <Sparkles className="h-16 w-16 text-white/90 drop-shadow-lg" />
                            <div className="absolute bottom-4 right-6 font-mono text-sm font-bold text-white/80 bg-black/30 px-2 py-1 rounded-md backdrop-blur-md">
                                v{CURRENT_VERSION}
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 rounded-full bg-black/20 p-2 text-white/70 hover:bg-black/40 hover:text-white transition-colors backdrop-blur-md"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {/* Body */}
                        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <h2 className="text-2xl font-bold text-white mb-6">What's New in Yorumi!</h2>
                            
                            <div className="space-y-6">
                                {/* Section 1 */}
                                <section>
                                    <h3 className="flex items-center gap-2 text-lg font-semibold text-yorumi-accent mb-3">
                                        <Zap className="h-5 w-5" />
                                        VidSrc & Player Upgrades
                                    </h3>
                                    <ul className="list-disc pl-5 space-y-2 text-gray-300 text-sm leading-relaxed">
                                        <li><strong className="text-white">VidSrc Default:</strong> VidSrc is now explicitly designated as the default streaming provider, ensuring reliable soft-subs out of the box.</li>
                                        <li><strong className="text-white">True Fullscreen Embeds:</strong> Clicking the fullscreen button within iframe-based players like VidSrc now explicitly forces the entire application to enter true OS-level full-monitor mode, bypassing standard Electron restrictions.</li>
                                    </ul>
                                </section>

                                {/* Section 2 */}
                                <section>
                                    <h3 className="flex items-center gap-2 text-lg font-semibold text-green-400 mb-3">
                                        <Code2 className="h-5 w-5" />
                                        Streamlined Providers
                                    </h3>
                                    <ul className="list-disc pl-5 space-y-2 text-gray-300 text-sm leading-relaxed">
                                        <li><strong className="text-white">AnimeGG Removed:</strong> AnimeGG has been completely removed from the frontend UI and backend scraper to simplify the fallback sequence and eliminate unreliable endpoints.</li>
                                        <li>The "ANIME" badge on AllManga was removed for a cleaner server dropdown.</li>
                                    </ul>
                                </section>

                                {/* Section 3 */}
                                <section>
                                    <h3 className="flex items-center gap-2 text-lg font-semibold text-[#facc15] mb-3">
                                        <Bug className="h-5 w-5" />
                                        Bug Fixes
                                    </h3>
                                    <ul className="list-disc pl-5 space-y-2 text-gray-300 text-sm leading-relaxed">
                                        <li>Fixed a persistent bug in the stream cache manager that forcefully reverted the selected server to AllManga every time a new anime page was opened. The player now consistently respects your default or chosen state.</li>
                                    </ul>
                                </section>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-white/10 bg-black/20 p-4 flex justify-end">
                            <button
                                onClick={handleClose}
                                className="rounded-xl bg-yorumi-accent px-6 py-2.5 text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-yorumi-accent/20"
                            >
                                Awesome, let's go!
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
