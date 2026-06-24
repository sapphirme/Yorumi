import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, Maximize2, MessageCircle, Play, Send, Sparkles, X } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { askYumi, type YumiChatMessage, type YumiChatMode } from '../../services/yumiService';
import {
    cleanYumiReply,
    getIntroReply,
    resolveRecommendationCards,
    type YumiRecommendationCard,
} from '../../services/yumiRecommendations';
import { getAnimeDetailsRouteId, getAnimeWatchRouteId } from '../../utils/animeNavigation';
import { cardItemVariants, dropdownVariants, modalPanelVariants, pressMotion } from '../../utils/motion';
import { slugify } from '../../utils/slugify';

const SUGGESTIONS = [
    { label: 'Surprise me!', prompt: 'Surprise me with anime recommendations.' },
    { label: 'Trending anime', prompt: 'Recommend trending anime right now.' },
    { label: 'Top horror', prompt: 'Recommend horror anime with great atmosphere.' },
    { label: 'Hidden gems', prompt: 'Recommend hidden gem anime.' },
    { label: 'Feel-good', prompt: 'Recommend feel-good anime.' },
];

const MANGA_SUGGESTIONS = [
    { label: 'Surprise me!', prompt: 'Surprise me with manga, manhwa, or manhua recommendations.' },
    { label: 'Trending manhwa', prompt: 'Recommend trending manhwa right now.' },
    { label: 'Top fantasy', prompt: 'Recommend fantasy manga and manhwa with great progression.' },
    { label: 'Hidden gems', prompt: 'Recommend hidden gem manga, manhwa, or manhua.' },
    { label: 'Villainess', prompt: 'Recommend villainess manhwa with strong character drama.' },
];

const EMPTY_STATE_MESSAGE = {
    title: "Hey there! I'm Yumi",
    body: "Your AI anime assistant. Ask me for anime picks, hidden gems, or something that fits your mood.",
};

const MANGA_EMPTY_STATE_MESSAGE = {
    title: "Hey there! I'm Yumi",
    body: "Your AI manga assistant. Ask me for manga, manhwa, manhua, hidden gems, or something that fits your mood.",
};

const YUMI_TRANSFER_KEY = 'yorumi:yumi-transfer';

type YumiWidgetTurn = {
    id: string;
    user: string;
    assistant?: string;
    cards: YumiRecommendationCard[];
};

interface YumiChatProps {
    isLauncherHidden?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
}

export default function YumiChat({ isLauncherHidden = false, onOpenChange }: YumiChatProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const mode: YumiChatMode = location.pathname.startsWith('/manga') ? 'manga' : 'anime';
    const isMangaMode = mode === 'manga';
    const suggestions = isMangaMode ? MANGA_SUGGESTIONS : SUGGESTIONS;
    const emptyStateMessage = isMangaMode ? MANGA_EMPTY_STATE_MESSAGE : EMPTY_STATE_MESSAGE;
    const accentClass = isMangaMode ? 'bg-yorumi-manga text-white' : 'bg-yorumi-accent text-[#06101e]';
    const launcherClass = isMangaMode ? 'bg-yorumi-manga hover:bg-yorumi-manga/90' : 'bg-yorumi-accent hover:bg-yorumi-accent/90';
    const userBubbleClass = isMangaMode
        ? 'bg-yorumi-manga text-white after:bg-yorumi-manga'
        : 'bg-yorumi-accent text-[#06101e] after:bg-yorumi-accent';
    const assistantBubbleClass = isMangaMode
        ? 'bg-[#231634] before:bg-[#231634]'
        : 'bg-[#132441] before:bg-[#132441]';
    const cardClass = isMangaMode
        ? 'bg-[#1f1430] hover:bg-[#2a1a42] hover:ring-yorumi-manga/35'
        : 'bg-[#10213d] hover:bg-[#132946] hover:ring-yorumi-accent/30';
    const secondaryButtonClass = isMangaMode
        ? 'bg-[#3b2558] text-purple-100 hover:bg-[#4a2d6f] hover:text-white'
        : 'bg-[#253a63] text-slate-300 hover:bg-[#2d4776] hover:text-white';
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<YumiChatMessage[]>([]);
    const [turns, setTurns] = useState<YumiWidgetTurn[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const visibleTurns = useMemo(() => turns.slice(-8), [turns]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [visibleTurns, isLoading]);

    useEffect(() => {
        return () => {
            onOpenChange?.(false);
        };
    }, [onOpenChange]);

    const handleDetailsClick = (card: YumiRecommendationCard) => {
        const item = card.item;
        if (!item) return;
        if (card.mediaType === 'manga') {
            const id = item.id || item.mal_id || ('scraper_id' in item ? item.scraper_id : undefined);
            if (id) {
                navigate(`/manga/details/${id}`, { state: { manga: item } });
                setIsOpen(false);
            }
            return;
        }

        const id = getAnimeDetailsRouteId(item);
        if (id) {
            navigate(`/anime/details/${id}`, { state: { anime: item } });
            setIsOpen(false);
        }
    };

    const handlePrimaryClick = (card: YumiRecommendationCard) => {
        const item = card.item;
        if (!item) return;
        if (card.mediaType === 'manga') {
            const id = item.id || item.mal_id || ('scraper_id' in item ? item.scraper_id : undefined);
            if (id) {
                navigate(`/manga/details/${id}`, { state: { manga: item } });
                setIsOpen(false);
            }
            return;
        }

        const id = getAnimeWatchRouteId(item) || getAnimeDetailsRouteId(item);
        if (id) {
            const title = slugify(item.title || card.title || 'anime');
            navigate(`/anime/details/${id}?ep=1`, { state: { anime: item } });
            setIsOpen(false);
        }
    };

    const submitMessage = async (rawMessage: string, displayMessage = rawMessage) => {
        const userMessage = rawMessage.trim();
        const visibleUserMessage = displayMessage.trim();
        if (!userMessage || isLoading) return;

        const turnId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const requestMessages: YumiChatMessage[] = [...messages, { role: 'user', content: userMessage }];

        setMessages(requestMessages);
        setTurns((current) => [...current, { id: turnId, user: visibleUserMessage || userMessage, cards: [] }]);
        setInput('');
        setIsLoading(true);

        try {
            const fullReply = cleanYumiReply(await askYumi(requestMessages, mode));
            const assistantReply = getIntroReply(fullReply);
            setMessages([...requestMessages, { role: 'assistant', content: fullReply }]);
            setTurns((current) => current.map((turn) =>
                turn.id === turnId ? { ...turn, assistant: assistantReply } : turn
            ));
            const cards = await resolveRecommendationCards(fullReply, 4, mode);
            setTurns((current) => current.map((turn) =>
                turn.id === turnId ? { ...turn, cards } : turn
            ));
        } catch (error) {
            const fallback = error instanceof Error
                ? error.message
                : 'Yumi could not respond right now. Try another recommendation request.';
            setMessages([...requestMessages, { role: 'assistant', content: fallback }]);
            setTurns((current) => current.map((turn) =>
                turn.id === turnId ? { ...turn, assistant: fallback, cards: [] } : turn
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        void submitMessage(input);
    };

    const handleOpen = () => {
        setIsOpen(true);
        onOpenChange?.(true);
        window.setTimeout(() => inputRef.current?.focus(), 120);
    };

    const handleClose = () => {
        setIsOpen(false);
        onOpenChange?.(false);
    };

    const handleExpand = () => {
        if (turns.length > 0) {
            sessionStorage.setItem(YUMI_TRANSFER_KEY, JSON.stringify({ messages, turns }));
        }
        handleClose();
        navigate('/yumi');
    };

    return (
        <div className="fixed bottom-5 right-4 z-[130] sm:right-6">
            <AnimatePresence>
                {isOpen && (
                    <m.section
                        variants={modalPanelVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className={`mb-3 flex h-[min(500px,calc(100vh-112px))] w-[calc(100vw-32px)] origin-bottom-right flex-col overflow-hidden rounded-[22px] text-white shadow-[0_24px_90px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:w-[390px] ${isMangaMode ? 'bg-[#120a1c]/95' : 'bg-[#07111f]/95'}`}
                        aria-label="Yumi recommendation chat"
                    >
                        <header className={`flex items-center justify-between px-5 py-3 ${isMangaMode ? 'bg-[#20122f]' : 'bg-[#0f1d34]'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${accentClass}`}>
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black leading-tight">Yumi</h2>
                                    <p className="text-xs font-semibold text-slate-400">{isMangaMode ? 'AI Manga Assistant' : 'AI Anime Assistant'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 text-slate-400">
                                <m.button
                                    whileTap={pressMotion}
                                    onClick={handleExpand}
                                    className="rounded-md p-2 transition-colors hover:bg-white/10 hover:text-white"
                                    aria-label="Open full Yumi chat"
                                >
                                    <Maximize2 className="h-4 w-4" />
                                </m.button>
                                <m.button
                                    whileTap={pressMotion}
                                    onClick={handleClose}
                                    className="rounded-md p-2 transition-colors hover:bg-white/10 hover:text-white"
                                    aria-label="Close Yumi chat"
                                >
                                    <X className="h-5 w-5" />
                                </m.button>
                            </div>
                        </header>

                        <div className={`flex-1 space-y-3 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-track-transparent ${isMangaMode ? 'scrollbar-thumb-yorumi-manga/30' : 'scrollbar-thumb-yorumi-accent/30'}`}>
                            {turns.length === 0 && (
                                <m.div
                                    variants={cardItemVariants}
                                    initial="initial"
                                    animate="animate"
                                    className="flex min-h-[250px] flex-col items-center justify-center text-center"
                                >
                                    <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full ${accentClass}`}>
                                        <Sparkles className="h-8 w-8" />
                                    </div>
                                    <h3 className="text-xl font-black text-white">{emptyStateMessage.title}</h3>
                                    <p className="mt-4 max-w-[280px] text-sm font-semibold leading-relaxed text-slate-500">
                                        {emptyStateMessage.body}
                                    </p>
                                </m.div>
                            )}

                            {visibleTurns.map((turn) => (
                                <div key={turn.id} className="space-y-3">
                                    <m.div
                                        variants={cardItemVariants}
                                        initial="initial"
                                        animate="animate"
                                        className="flex justify-end"
                                    >
                                        <div className={`relative max-w-[82%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed shadow-lg after:absolute after:bottom-0 after:right-[-6px] after:h-3 after:w-3 after:[clip-path:polygon(0_0,100%_100%,0_100%)] ${userBubbleClass}`}>
                                            {turn.user}
                                        </div>
                                    </m.div>

                                    {turn.assistant && (
                                        <m.div
                                            variants={cardItemVariants}
                                            initial="initial"
                                            animate="animate"
                                            className="flex items-start gap-3"
                                        >
                                            <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${accentClass}`}>
                                                <Sparkles className="h-4 w-4" />
                                            </div>
                                            <div className={`relative max-w-[calc(100%-44px)] whitespace-pre-wrap rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed text-slate-100 shadow-lg before:absolute before:bottom-0 before:left-[-6px] before:h-3 before:w-3 before:[clip-path:polygon(100%_0,100%_100%,0_100%)] ${assistantBubbleClass}`}>
                                                {turn.assistant}
                                            </div>
                                        </m.div>
                                    )}

                                    {turn.cards.map((card) => (
                                        <m.div
                                            key={`${turn.id}-${card.title}`}
                                            variants={cardItemVariants}
                                            initial="initial"
                                            animate="animate"
                                            whileHover={{ y: -2, scale: 1.01 }}
                                            transition={{ duration: 0.18, ease: 'easeOut' }}
                                            className="pl-[44px]"
                                        >
                                            <div className={`flex gap-3 rounded-lg p-3 shadow-lg transition-colors hover:ring-1 ${cardClass}`}>
                                                <div className="h-[82px] w-[58px] shrink-0 overflow-hidden rounded-md bg-black/30">
                                                    {card.image ? (
                                                        <img src={card.image} alt={card.title} className="h-full w-full object-cover" loading="lazy" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-slate-500">
                                                            <Sparkles className="h-5 w-5" />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <h3 className="truncate text-sm font-black text-slate-100">{card.title}</h3>
                                                    <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-400">
                                                        {typeof card.score === 'number' && card.score > 0 && (
                                                            <span className="text-[#facc15]">★ {card.score.toFixed(1)}</span>
                                                        )}
                                                        {card.year && <span>{card.year}</span>}
                                                    </div>
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <m.button
                                                            whileTap={pressMotion}
                                                            onClick={() => handlePrimaryClick(card)}
                                                            disabled={!card.item}
                                                            className={`inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-black leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isMangaMode ? 'bg-yorumi-manga text-white hover:bg-yorumi-manga/90' : 'bg-yorumi-accent text-[#06101e] hover:bg-yorumi-accent/90'}`}
                                                        >
                                                            <Play className="h-3 w-3 shrink-0" />
                                                            {card.mediaType === 'manga' ? 'Read' : 'Watch'}
                                                        </m.button>
                                                        <m.button
                                                            whileTap={pressMotion}
                                                            onClick={() => handleDetailsClick(card)}
                                                            disabled={!card.item}
                                                            className={`inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-bold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${secondaryButtonClass}`}
                                                        >
                                                            <Eye className="h-3 w-3 shrink-0" />
                                                            Details
                                                        </m.button>
                                                    </div>
                                                </div>
                                            </div>
                                        </m.div>
                                    ))}
                                </div>
                            ))}

                            {isLoading && (
                                <m.div variants={dropdownVariants} initial="initial" animate="animate" exit="exit" className="flex items-center gap-3">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${accentClass}`}>
                                        <Sparkles className="h-4 w-4" />
                                    </div>
                                    <div className={`relative flex h-10 items-center gap-1.5 rounded-2xl rounded-bl-md px-4 shadow-lg before:absolute before:bottom-0 before:left-[-6px] before:h-3 before:w-3 before:[clip-path:polygon(100%_0,100%_100%,0_100%)] ${assistantBubbleClass}`}>
                                        {[0, 1, 2].map((dot) => (
                                            <span
                                                key={dot}
                                                className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-500"
                                                style={{ animationDelay: `${dot * 120}ms`, animationDuration: '720ms' }}
                                            />
                                        ))}
                                    </div>
                                </m.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        <div className={`p-3 ${isMangaMode ? 'bg-[#130b1f]' : 'bg-[#081321]'}`}>
                            {turns.length === 0 && (
                                <div className="mb-4 flex flex-wrap gap-2">
                                    {suggestions.map((suggestion) => (
                                        <m.button
                                            key={suggestion.label}
                                            whileTap={pressMotion}
                                            onClick={() => submitMessage(suggestion.prompt, suggestion.label)}
                                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors hover:text-white ${isMangaMode ? 'bg-[#26143c] text-purple-100 hover:bg-[#352054]' : 'bg-[#122a48] text-slate-300 hover:bg-[#17365d]'}`}
                                        >
                                            {suggestion.label}
                                        </m.button>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    value={input}
                                    onChange={(event) => setInput(event.target.value)}
                                    placeholder={isMangaMode ? 'Ask Yumi about manga...' : 'Ask Yumi anything...'}
                                    className={`h-10 min-w-0 flex-1 rounded-lg px-4 text-sm text-white outline-none ring-1 transition-shadow placeholder:text-slate-500 focus:ring-2 ${isMangaMode ? 'bg-[#08030d] ring-yorumi-manga/60 focus:ring-yorumi-manga' : 'bg-[#030913] ring-yorumi-accent/60 focus:ring-yorumi-accent'}`}
                                    maxLength={500}
                                />
                                <m.button
                                    whileTap={pressMotion}
                                    disabled={!input.trim() || isLoading}
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 ${accentClass}`}
                                    aria-label="Send message to Yumi"
                                >
                                    <Send className="h-4 w-4" />
                                </m.button>
                            </form>
                        </div>
                    </m.section>
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {isOpen ? (
                    <m.button
                        key="close-yumi"
                        variants={dropdownVariants}
                        initial="initial"
                        exit="exit"
                        animate="animate"
                        whileTap={pressMotion}
                        onClick={handleClose}
                        className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#17284a] text-white shadow-lg transition-all duration-300 ease-out hover:scale-110 hover:bg-[#20365f] active:scale-95"
                        aria-label="Close Yumi chat"
                    >
                        <X className="h-6 w-6" strokeWidth={2.5} />
                    </m.button>
                ) : !isLauncherHidden && (
                    <m.button
                        key="open-yumi"
                        variants={dropdownVariants}
                        initial="initial"
                        exit="exit"
                        animate="animate"
                        whileTap={pressMotion}
                        onClick={handleOpen}
                        className={`ml-auto flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 ease-out hover:scale-110 active:scale-95 ${launcherClass}`}
                        aria-label="Open Yumi chat"
                    >
                        <MessageCircle className="h-6 w-6" strokeWidth={2.5} />
                    </m.button>
                )}
            </AnimatePresence>
        </div>
    );
}
