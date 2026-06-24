import { useState, useEffect, useCallback } from 'react';
import { storage, type ReadListItem } from '../utils/storage';

export function useReadList() {
    const [readList, setReadList] = useState<ReadListItem[]>(() => storage.getReadList());
    const [loading] = useState(false);

    const reload = useCallback(() => {
        setReadList(storage.getReadList());
    }, []);

    useEffect(() => {
        window.addEventListener('yorumi-storage-updated', reload);
        return () => window.removeEventListener('yorumi-storage-updated', reload);
    }, [reload]);

    const addToReadList = useCallback((item: Omit<ReadListItem, 'addedAt'>) => {
        storage.addToReadList(item, item.status || 'reading');
    }, []);

    const removeFromReadList = useCallback((id: string) => {
        storage.removeFromReadList(id);
    }, []);

    const isInReadList = useCallback((id: string) => {
        return readList.some(item => item.id === id);
    }, [readList]);

    return {
        readList,
        loading,
        addToReadList,
        removeFromReadList,
        isInReadList
    };
}
