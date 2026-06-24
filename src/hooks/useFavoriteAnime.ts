import { useCallback, useEffect, useState } from 'react';

export interface FavoriteAnimeItem {
    id: string;
    title: string;
    image: string;
    synopsis?: string;
    addedAt: number;
}

const FAVORITE_ANIME_KEY = 'yorumi_favorite_anime';
const STORAGE_EVENT = 'yorumi-storage-updated';

const readFavorites = (): FavoriteAnimeItem[] => {
    try {
        const raw = localStorage.getItem(FAVORITE_ANIME_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeFavorites = (items: FavoriteAnimeItem[]) => {
    localStorage.setItem(FAVORITE_ANIME_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
};

export function useFavoriteAnime() {
    const [favorites, setFavorites] = useState<FavoriteAnimeItem[]>(() => readFavorites());
    const [loading] = useState(false);

    const reload = useCallback(() => {
        setFavorites(readFavorites());
    }, []);

    useEffect(() => {
        window.addEventListener(STORAGE_EVENT, reload);
        return () => window.removeEventListener(STORAGE_EVENT, reload);
    }, [reload]);

    const addFavorite = useCallback(async (item: Omit<FavoriteAnimeItem, 'addedAt'>) => {
        const current = readFavorites();
        if (current.some((entry) => entry.id === item.id)) return;
        writeFavorites([{ ...item, addedAt: Date.now() }, ...current]);
    }, []);

    const removeFavorite = useCallback(async (id: string) => {
        writeFavorites(readFavorites().filter((entry) => entry.id !== id));
    }, []);

    const isFavorite = useCallback((id: string) => favorites.some((entry) => entry.id === id), [favorites]);

    return {
        favorites,
        loading,
        addFavorite,
        removeFavorite,
        isFavorite
    };
}
