

import { setLocalStorageWithCleanup } from './localStorageQuota';

export interface WatchProgress {
    animeId: string;
    episodeId: string;
    episodeNumber: number;
    timestamp: number;
    lastWatched: number;
    animeTitle: string;
    animeImage: string;
    animePoster?: string;
    totalCount?: number;
    mediaStatus?: string;
    positionSeconds?: number;
    durationSeconds?: number;
}

export interface ReadProgress {
    mangaId: string;
    chapterId: string;
    chapterNumber: string; // Chapters can be 10.5
    timestamp: number;
    lastRead: number;
    mangaTitle: string;
    mangaImage: string;
    mangaPoster?: string;
    totalCount?: number;
    mediaStatus?: string;
}

export interface AnimeCompletionSnapshot {
    title?: string;
    totalCount?: number;
    mediaStatus?: string;
}

export interface MangaCompletionSnapshot {
    title?: string;
    totalCount?: number;
    mediaStatus?: string;
}

export interface WatchListItem {
    id: string;
    anilistId?: string;
    malId?: string;
    scraperId?: string;
    title: string;
    image: string;
    addedAt: number;
    status: 'watching' | 'completed' | 'plan_to_watch' | 'dropped';
    score?: number;
    currentProgress?: number;
    totalCount?: number; // Episodes
    type?: string;
    genres?: string[];
    mediaStatus?: string;
    synopsis?: string;
}

export interface ReadListItem {
    id: string;
    anilistId?: string;
    malId?: string;
    scraperId?: string;
    title: string;
    image: string;
    addedAt: number;
    status: 'reading' | 'completed' | 'plan_to_read' | 'dropped';
    score?: number;
    currentProgress?: number;
    totalCount?: number; // Chapters
    type?: string;
    genres?: string[];
    mediaStatus?: string;
    synopsis?: string;
}

const STORAGE_KEYS = {
    CONTINUE_WATCHING: 'yorumi_continue_watching',
    CONTINUE_READING: 'yorumi_continue_reading',
    CONTINUE_WATCHING_PENDING_DELETES: 'yorumi_continue_watching_pending_deletes',
    CONTINUE_READING_PENDING_DELETES: 'yorumi_continue_reading_pending_deletes',
    WATCH_LIST: 'yorumi_watch_list',
    READ_LIST: 'yorumi_read_list',
    EPISODE_HISTORY: 'yorumi_episode_history',
    CHAPTER_HISTORY: 'yorumi_chapter_history',
    VAULT_CONTINUE_WATCHING: 'yorumi_vault_continue_watching',
    VAULT_CONTINUE_READING: 'yorumi_vault_continue_reading',
    VAULT_CONTINUE_WATCHING_PENDING_DELETES: 'yorumi_vault_cw_pending_deletes',
    VAULT_CONTINUE_READING_PENDING_DELETES: 'yorumi_vault_cr_pending_deletes',
    VAULT_WATCH_LIST: 'yorumi_vault_watch_list',
    VAULT_READ_LIST: 'yorumi_vault_read_list',
    ANIME_WATCH_TIME: 'yorumi_anime_watch_time',
    ANIME_WATCH_TIME_TOTAL: 'yorumi_anime_watch_time_total',
    ANIME_GENRE_CACHE: 'yorumi_anime_genre_cache',
    ANIME_COMPLETION_CACHE: 'yorumi_anime_completion_cache',
    MANGA_COMPLETION_CACHE: 'yorumi_manga_completion_cache',
    MANGA_GENRE_CACHE: 'yorumi_manga_genre_cache',
    CLOUD_WRITE_QUEUE: 'yorumi_cloud_write_queue'
};








const storageMemoryCache = new Map<string, string>();

const getScopedStorageKey = (key: string, uidOverride?: string | null) => {
    const uid = uidOverride;
    return uid ? `${key}_${uid}` : key;
};


































const setScopedItemForUid = (key: string, value: string, uidOverride?: string | null) => {
    const scopedKey = getScopedStorageKey(key, uidOverride);
    storageMemoryCache.set(scopedKey, value);

    try {
        if (!setLocalStorageWithCleanup(scopedKey, value)) {
            throw new Error('localStorage quota cleanup did not free enough space');
        }
    } catch (error) {
        console.warn(`Failed to persist ${scopedKey} to localStorage; keeping in memory only.`, error);
    }
};

const setScopedItem = (key: string, value: string) => {
    setScopedItemForUid(key, value);
};

const getScopedItemForUid = (key: string, uidOverride?: string | null) => {
    const scopedKey = getScopedStorageKey(key, uidOverride);
    if (storageMemoryCache.has(scopedKey)) {
        return storageMemoryCache.get(scopedKey) || null;
    }

    try {
        const stored = localStorage.getItem(scopedKey);
        if (stored != null) {
            storageMemoryCache.set(scopedKey, stored);
        }
        return stored;
    } catch (error) {
        console.warn(`Failed to read ${scopedKey} from localStorage.`, error);
        return null;
    }
};

const getScopedItem = (key: string) => {
    return getScopedItemForUid(key);
};










const clearLocalProgressStorage = () => {
    try {
        Object.values(STORAGE_KEYS).forEach((key) => {
            storageMemoryCache.delete(key);
            localStorage.removeItem(key);
            const scopedPrefix = `${key}_`;
            for (let i = localStorage.length - 1; i >= 0; i -= 1) {
                const k = localStorage.key(i);
                if (k && k.startsWith(scopedPrefix)) {
                    storageMemoryCache.delete(k);
                    localStorage.removeItem(k);
                }
            }
        });
        emitStorageUpdated();
    } catch (error) {
        console.error('Failed to clear local progress storage:', error);
    }
};

const clearLegacyUnscopedProgressStorage = () => {
    try {
        Object.values(STORAGE_KEYS).forEach((key) => {
            storageMemoryCache.delete(key);
            localStorage.removeItem(key);
        });
        emitStorageUpdated();
    } catch (error) {
        console.error('Failed to clear legacy progress storage:', error);
    }
};

const emitStorageUpdated = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yorumi-storage-updated'));
    }
};

const getPendingDeleteIds = (key: string): string[] => {
    try {
        const data = getScopedItem(key);
        const parsed = data ? JSON.parse(data) : [];
        return Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
    } catch {
        return [];
    }
};

const addPendingDeleteId = (key: string, id: string) => {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return;
    const next = Array.from(new Set([...getPendingDeleteIds(key), normalizedId]));
    setScopedItem(key, JSON.stringify(next));
};

const removePendingDeleteId = (key: string, id: string) => {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return;
    const next = getPendingDeleteIds(key).filter((value) => value !== normalizedId);
    setScopedItem(key, JSON.stringify(next));
};

export const storage = {
    // Continue Watching
    saveProgress: (progress: Omit<WatchProgress, 'lastWatched'>, isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_CONTINUE_WATCHING : STORAGE_KEYS.CONTINUE_WATCHING;
        const delKey = isVault ? STORAGE_KEYS.VAULT_CONTINUE_WATCHING_PENDING_DELETES : STORAGE_KEYS.CONTINUE_WATCHING_PENDING_DELETES;
        try {
            removePendingDeleteId(delKey, progress.animeId);
            const current = storage.getContinueWatching(isVault);
            const updated = [
                { ...progress, lastWatched: Date.now() },
                ...current.filter(item => item.animeId !== progress.animeId)
            ].slice(0, 20); // Keep last 20

            setScopedItem(key, JSON.stringify(updated));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to save progress:', error);
        }
    },

    getContinueWatching: (isVault?: boolean): WatchProgress[] => {
        const key = isVault ? STORAGE_KEYS.VAULT_CONTINUE_WATCHING : STORAGE_KEYS.CONTINUE_WATCHING;
        try {
            const data = getScopedItem(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get continue watching:', error);
            return [];
        }
    },

    setContinueWatching: (items: WatchProgress[], isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_CONTINUE_WATCHING : STORAGE_KEYS.CONTINUE_WATCHING;
        try {
            setScopedItem(key, JSON.stringify(Array.isArray(items) ? items : []));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set continue watching:', error);
        }
    },

    removeFromContinueWatching: (animeId: string, isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_CONTINUE_WATCHING : STORAGE_KEYS.CONTINUE_WATCHING;
        const delKey = isVault ? STORAGE_KEYS.VAULT_CONTINUE_WATCHING_PENDING_DELETES : STORAGE_KEYS.CONTINUE_WATCHING_PENDING_DELETES;
        try {
            addPendingDeleteId(delKey, animeId);
            const current = storage.getContinueWatching(isVault);
            const updated = current.filter(item => item.animeId !== animeId);
            setScopedItem(key, JSON.stringify(updated));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to remove from continue watching:', error);
        }
    },

    // Continue Reading
    saveReadingProgress: (progress: Omit<ReadProgress, 'lastRead'>, isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_CONTINUE_READING : STORAGE_KEYS.CONTINUE_READING;
        const delKey = isVault ? STORAGE_KEYS.VAULT_CONTINUE_READING_PENDING_DELETES : STORAGE_KEYS.CONTINUE_READING_PENDING_DELETES;
        try {
            removePendingDeleteId(delKey, progress.mangaId);
            const current = storage.getContinueReading(isVault);
            const updated = [
                { ...progress, lastRead: Date.now() },
                ...current.filter(item => item.mangaId !== progress.mangaId)
            ].slice(0, 20); // Keep last 20

            setScopedItem(key, JSON.stringify(updated));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to save reading progress:', error);
        }
    },

    getContinueReading: (isVault?: boolean): ReadProgress[] => {
        const key = isVault ? STORAGE_KEYS.VAULT_CONTINUE_READING : STORAGE_KEYS.CONTINUE_READING;
        try {
            const data = getScopedItem(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get continue reading:', error);
            return [];
        }
    },

    setContinueReading: (items: ReadProgress[], isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_CONTINUE_READING : STORAGE_KEYS.CONTINUE_READING;
        try {
            setScopedItem(key, JSON.stringify(Array.isArray(items) ? items : []));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set continue reading:', error);
        }
    },

    removeFromContinueReading: (mangaId: string, isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_CONTINUE_READING : STORAGE_KEYS.CONTINUE_READING;
        const delKey = isVault ? STORAGE_KEYS.VAULT_CONTINUE_READING_PENDING_DELETES : STORAGE_KEYS.CONTINUE_READING_PENDING_DELETES;
        try {
            addPendingDeleteId(delKey, mangaId);
            const current = storage.getContinueReading(isVault);
            const updated = current.filter(item => item.mangaId !== mangaId);
            setScopedItem(key, JSON.stringify(updated));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to remove from continue reading:', error);
        }
    },

    // Watch List
    addToWatchList: (item: Omit<WatchListItem, 'addedAt' | 'status'>, status: WatchListItem['status'] = 'watching', isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_WATCH_LIST : STORAGE_KEYS.WATCH_LIST;
        try {
            const current = storage.getWatchList(isVault);
            if (current.some(i => i.id === item.id)) return; // Already in list

            const updated = [
                { ...item, status, addedAt: Date.now() },
                ...current
            ];

            setScopedItem(key, JSON.stringify(updated));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to add to watch list:', error);
        }
    },

    removeFromWatchList: (animeId: string, isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_WATCH_LIST : STORAGE_KEYS.WATCH_LIST;
        try {
            const current = storage.getWatchList(isVault);
            const updated = current.filter(item => item.id !== animeId);
            setScopedItem(key, JSON.stringify(updated));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to remove from watch list:', error);
        }
    },

    getWatchList: (isVault?: boolean): WatchListItem[] => {
        const key = isVault ? STORAGE_KEYS.VAULT_WATCH_LIST : STORAGE_KEYS.WATCH_LIST;
        try {
            const data = getScopedItem(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get watch list:', error);
            return [];
        }
    },

    setWatchList: (items: WatchListItem[], isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_WATCH_LIST : STORAGE_KEYS.WATCH_LIST;
        try {
            setScopedItem(key, JSON.stringify(Array.isArray(items) ? items : []));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set watch list:', error);
        }
    },

    isInWatchList: (animeId: string, isVault?: boolean): boolean => {
        const list = storage.getWatchList(isVault);
        return list.some(item => item.id === animeId);
    },

    // Read List
    addToReadList: (item: Omit<ReadListItem, 'addedAt' | 'status'>, status: ReadListItem['status'] = 'reading', isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_READ_LIST : STORAGE_KEYS.READ_LIST;
        try {
            const current = storage.getReadList(isVault);
            if (current.some(i => i.id === item.id)) return;

            const updated = [
                { ...item, status, addedAt: Date.now() },
                ...current
            ];

            setScopedItem(key, JSON.stringify(updated));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to add to read list:', error);
        }
    },

    removeFromReadList: (mangaId: string, isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_READ_LIST : STORAGE_KEYS.READ_LIST;
        try {
            const current = storage.getReadList(isVault);
            const updated = current.filter(item => item.id !== mangaId);
            setScopedItem(key, JSON.stringify(updated));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to remove from read list:', error);
        }
    },

    getReadList: (isVault?: boolean): ReadListItem[] => {
        const key = isVault ? STORAGE_KEYS.VAULT_READ_LIST : STORAGE_KEYS.READ_LIST;
        try {
            const data = getScopedItem(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get read list:', error);
            return [];
        }
    },

    setReadList: (items: ReadListItem[], isVault?: boolean) => {
        const key = isVault ? STORAGE_KEYS.VAULT_READ_LIST : STORAGE_KEYS.READ_LIST;
        try {
            setScopedItem(key, JSON.stringify(Array.isArray(items) ? items : []));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set read list:', error);
        }
    },

    isInReadList: (mangaId: string, isVault?: boolean): boolean => {
        const list = storage.getReadList(isVault);
        return list.some(item => item.id === mangaId);
    },

    // Episode History (Watched Episodes)
    markEpisodeAsWatched: (animeId: string, episodeNumber: number) => {
        try {
            const history = storage.getEpisodeHistory();
            if (!history[animeId]) history[animeId] = [];
            if (!history[animeId].includes(episodeNumber)) {
                history[animeId].push(episodeNumber);
                setScopedItem(STORAGE_KEYS.EPISODE_HISTORY, JSON.stringify(history));
                emitStorageUpdated();
            }
        } catch (error) {
            console.error('Failed to mark episode as watched:', error);
        }
    },

    unmarkEpisodeAsWatched: (animeId: string, episodeNumber: number) => {
        try {
            const history = storage.getEpisodeHistory();
            if (history[animeId] && history[animeId].includes(episodeNumber)) {
                history[animeId] = history[animeId].filter(ep => ep !== episodeNumber);
                setScopedItem(STORAGE_KEYS.EPISODE_HISTORY, JSON.stringify(history));
                emitStorageUpdated();
            }
        } catch (error) {
            console.error('Failed to unmark episode as watched:', error);
        }
    },

    getEpisodeHistory: (): Record<string, number[]> => {
        try {
            const data = getScopedItem(STORAGE_KEYS.EPISODE_HISTORY);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    },

    setEpisodeHistory: (history: Record<string, number[]>) => {
        try {
            setScopedItem(STORAGE_KEYS.EPISODE_HISTORY, JSON.stringify(history || {}));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set episode history:', error);
        }
    },

    getWatchedEpisodes: (animeId: string): number[] => {
        const history = storage.getEpisodeHistory();
        return history[animeId] || [];
    },

    // Anime watch time (seconds)
    addAnimeWatchTime: (animeId: string, seconds: number) => {
        try {
            if (!animeId || !Number.isFinite(seconds) || seconds <= 0) return;
            const current = storage.getAnimeWatchTime();
            const normalized = Math.floor(seconds);
            current[animeId] = (current[animeId] || 0) + normalized;
            setScopedItem(STORAGE_KEYS.ANIME_WATCH_TIME, JSON.stringify(current));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to add anime watch time:', error);
        }
    },

    getAnimeWatchTime: (): Record<string, number> => {
        try {
            const data = getScopedItem(STORAGE_KEYS.ANIME_WATCH_TIME);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Failed to get anime watch time:', error);
            return {};
        }
    },

    setAnimeWatchTime: (watchTime: Record<string, number>) => {
        try {
            setScopedItem(STORAGE_KEYS.ANIME_WATCH_TIME, JSON.stringify(watchTime || {}));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set anime watch time:', error);
        }
    },

    getAnimeWatchTimeSeconds: (animeId: string): number => {
        const data = storage.getAnimeWatchTime();
        return data[animeId] || 0;
    },

    addAnimeWatchTimeTotal: (seconds: number) => {
        try {
            if (!Number.isFinite(seconds) || seconds <= 0) return;

            const normalized = Math.floor(seconds);
            const current = storage.getAnimeWatchTimeTotalSeconds();
            setScopedItem(STORAGE_KEYS.ANIME_WATCH_TIME_TOTAL, JSON.stringify(current + normalized));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to add anime total watch time:', error);
        }
    },

    getAnimeWatchTimeTotalSeconds: (): number => {
        try {
            const data = getScopedItem(STORAGE_KEYS.ANIME_WATCH_TIME_TOTAL);
            if (data) {
                const parsed = Number(JSON.parse(data));
                if (Number.isFinite(parsed) && parsed >= 0) return parsed;
            }

            // Backfill from legacy per-anime map when no dedicated total exists yet.
            return Object.values(storage.getAnimeWatchTime()).reduce((sum, seconds) => {
                const safeSeconds = Number(seconds) || 0;
                return sum + Math.max(0, safeSeconds);
            }, 0);
        } catch (error) {
            console.error('Failed to get anime total watch time:', error);
            return 0;
        }
    },

    setAnimeWatchTimeTotalSeconds: (seconds: number) => {
        try {
            const normalized = Math.max(0, Math.floor(Number(seconds) || 0));
            setScopedItem(STORAGE_KEYS.ANIME_WATCH_TIME_TOTAL, JSON.stringify(normalized));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set anime total watch time:', error);
        }
    },

    // Genre caches
    getAnimeGenreCache: (): Record<string, string[]> => {
        try {
            const data = getScopedItem(STORAGE_KEYS.ANIME_GENRE_CACHE);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Failed to get anime genre cache:', error);
            return {};
        }
    },

    setAnimeGenreCache: (cache: Record<string, string[]>) => {
        try {
            setScopedItem(STORAGE_KEYS.ANIME_GENRE_CACHE, JSON.stringify(cache || {}));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set anime genre cache:', error);
        }
    },

    getAnimeCompletionCache: (): Record<string, AnimeCompletionSnapshot> => {
        try {
            const data = getScopedItem(STORAGE_KEYS.ANIME_COMPLETION_CACHE);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Failed to get anime completion cache:', error);
            return {};
        }
    },

    setAnimeCompletionCache: (cache: Record<string, AnimeCompletionSnapshot>) => {
        try {
            setScopedItem(STORAGE_KEYS.ANIME_COMPLETION_CACHE, JSON.stringify(cache || {}));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set anime completion cache:', error);
        }
    },

    getMangaCompletionCache: (): Record<string, MangaCompletionSnapshot> => {
        try {
            const data = getScopedItem(STORAGE_KEYS.MANGA_COMPLETION_CACHE);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Failed to get manga completion cache:', error);
            return {};
        }
    },

    setMangaCompletionCache: (cache: Record<string, MangaCompletionSnapshot>) => {
        try {
            setScopedItem(STORAGE_KEYS.MANGA_COMPLETION_CACHE, JSON.stringify(cache || {}));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set manga completion cache:', error);
        }
    },

    getMangaGenreCache: (): Record<string, string[]> => {
        try {
            const data = getScopedItem(STORAGE_KEYS.MANGA_GENRE_CACHE);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Failed to get manga genre cache:', error);
            return {};
        }
    },

    setMangaGenreCache: (cache: Record<string, string[]>) => {
        try {
            setScopedItem(STORAGE_KEYS.MANGA_GENRE_CACHE, JSON.stringify(cache || {}));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set manga genre cache:', error);
        }
    },

    // Chapter History (Read Chapters)
    markChapterAsRead: (mangaId: string, chapterId: string) => {
        try {
            const history = storage.getChapterHistory();
            if (!history[mangaId]) history[mangaId] = [];
            if (!history[mangaId].includes(chapterId)) {
                history[mangaId].push(chapterId);
                setScopedItem(STORAGE_KEYS.CHAPTER_HISTORY, JSON.stringify(history));
                emitStorageUpdated();
            }
        } catch (error) {
            console.error('Failed to mark chapter as read:', error);
        }
    },

    getChapterHistory: (): Record<string, string[]> => {
        try {
            const data = getScopedItem(STORAGE_KEYS.CHAPTER_HISTORY);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    },

    setChapterHistory: (history: Record<string, string[]>) => {
        try {
            setScopedItem(STORAGE_KEYS.CHAPTER_HISTORY, JSON.stringify(history || {}));
            emitStorageUpdated();
        } catch (error) {
            console.error('Failed to set chapter history:', error);
        }
    },

    getReadChapters: (mangaId: string): string[] => {
        const history = storage.getChapterHistory();
        return history[mangaId] || [];
    }
};

const syncStorage = { pushToCloud: async () => {}, pullFromCloud: async () => {}, replayPendingWrites: async () => {} };
