import { useState, useEffect, useCallback } from 'react';
import { storage, type WatchListItem } from '../utils/storage';

export function useWatchList(options: { isVault?: boolean } = {}) {
    const { isVault } = options;
    const [watchList, setWatchList] = useState<WatchListItem[]>(() => storage.getWatchList(isVault));
    const [loading] = useState(false);

    const reload = useCallback(() => {
        setWatchList(storage.getWatchList(isVault));
    }, [isVault]);

    useEffect(() => {
        window.addEventListener('yorumi-storage-updated', reload);
        return () => window.removeEventListener('yorumi-storage-updated', reload);
    }, [reload]);

    const addToWatchList = useCallback((item: Omit<WatchListItem, 'addedAt'>) => {
        storage.addToWatchList(item, item.status || 'watching', isVault);
    }, [isVault]);

    const removeFromWatchList = useCallback((id: string) => {
        storage.removeFromWatchList(id, isVault);
    }, [isVault]);

    const isInWatchList = useCallback((id: string) => {
        return watchList.some(item => item.id === id);
    }, [watchList]);

    return {
        watchList,
        loading,
        addToWatchList,
        removeFromWatchList,
        isInWatchList
    };
}
