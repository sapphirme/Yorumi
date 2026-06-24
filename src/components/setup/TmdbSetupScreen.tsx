import { useEffect, useRef, useState } from 'react';
import { Play, ExternalLink, KeyRound } from 'lucide-react';
import { tmdbService } from '../../services/tmdbService';

type SetupError = {
    title: string;
    body: string;
};

const getErrorMessage = (reason: string, status?: number): SetupError => {
    switch (reason) {
        case 'invalid_token':
            return {
                title: 'Invalid token',
                body: 'TMDB rejected the token. Copy the long API Read Access Token that starts with eyJ, not the shorter API key.',
            };
        case 'forbidden':
            return {
                title: 'Access denied',
                body: 'TMDB returned 403 Forbidden. The token may have been revoked or the account may not have API access.',
            };
        case 'timeout':
            return {
                title: 'Request timed out',
                body: 'TMDB took too long to respond. Check your internet connection and try again.',
            };
        case 'unreachable':
            return {
                title: 'Cannot reach TMDB',
                body: 'No connection to api.themoviedb.org. Check your internet connection.',
            };
        default:
            return {
                title: 'TMDB error',
                body: `TMDB returned an unexpected error${status ? ` (${status})` : ''}. Try again in a moment.`,
            };
    }
};

const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
};

export default function TmdbSetupScreen({ onReady }: { onReady: () => void }) {
    const [token, setToken] = useState('');
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<SetupError | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const timeout = window.setTimeout(() => inputRef.current?.focus(), 50);
        return () => window.clearTimeout(timeout);
    }, []);

    const handleSubmit = async () => {
        const value = token.trim();
        if (!value || checking) return;

        setChecking(true);
        setError(null);
        const result = await tmdbService.validateToken(value);
        setChecking(false);

        if (result.ok) {
            tmdbService.saveToken(value);
            onReady();
            return;
        }

        setError(getErrorMessage(result.reason, result.status));
    };

    return (
        <div className="min-h-screen bg-[#07090d] text-white flex items-center justify-center px-5">
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-yorumi-accent/15 blur-[120px]" />
                <div className="absolute -bottom-36 -right-28 h-[28rem] w-[28rem] rounded-full bg-yorumi-main/10 blur-[140px]" />
            </div>

            <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#0e1117]/95 p-7 shadow-2xl shadow-black/50">
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yorumi-accent/15 text-yorumi-accent">
                        <KeyRound className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Set Up TMDB</h1>
                        <p className="text-sm text-gray-400">Yorumi uses TMDB to resolve accurate season metadata.</p>
                    </div>
                </div>

                <div className="space-y-4 text-sm leading-relaxed text-gray-300">
                    <p>
                        Paste your free TMDB API Read Access Token to continue. Use the long token that starts with
                        <span className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white">eyJ</span>
                        rather than the shorter API key.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => openExternal('https://www.themoviedb.org/settings/api')}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-bold text-white transition-colors hover:border-yorumi-accent/60 hover:text-yorumi-accent"
                        >
                            TMDB API Settings
                            <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => openExternal('https://github.com/truelockmc/streambert/blob/main/tmdb-tutorial.md')}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-bold text-white transition-colors hover:border-yorumi-accent/60 hover:text-yorumi-accent"
                        >
                            Step-by-step guide
                            <ExternalLink className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    <input
                        ref={inputRef}
                        type="password"
                        value={token}
                        onChange={(event) => {
                            setToken(event.target.value);
                            setError(null);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSubmit();
                        }}
                        placeholder="Paste your TMDB Read Access Token"
                        disabled={checking}
                        className={`h-12 w-full rounded-xl border bg-black/30 px-4 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-yorumi-accent ${
                            error ? 'border-red-500/70' : 'border-white/10'
                        }`}
                    />

                    {error && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                            <div className="font-black text-red-200">{error.title}</div>
                            <div className="mt-1 text-sm text-red-100/80">{error.body}</div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!token.trim() || checking}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-yorumi-accent px-5 font-black text-black transition-colors hover:bg-[#62c5f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {checking ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                                Checking
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4 fill-current" />
                                Continue
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
