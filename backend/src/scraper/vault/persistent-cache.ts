import fs from 'fs';
import os from 'os';
import path from 'path';

type VaultHomeKind = 'anime' | 'manga';

interface PersistedVaultCache {
    version: 1;
    updatedAt: number;
    data: unknown;
}

const CACHE_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> => (
    !!value && typeof value === 'object' && !Array.isArray(value)
);

const getDefaultUserDataDir = () => {
    if (process.platform === 'win32') {
        const base = process.env.APPDATA || process.env.LOCALAPPDATA || os.homedir();
        return path.join(base, 'Yorumi');
    }

    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Yorumi');
    }

    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Yorumi');
};

const getVaultCacheDir = () => (
    path.join(process.env.YORUMI_USER_DATA_DIR || getDefaultUserDataDir(), 'vault-cache')
);

const getVaultHomeCacheFile = (kind: VaultHomeKind) => (
    path.join(getVaultCacheDir(), `${kind}-home.json`)
);

export const isUsableVaultHomeData = (kind: VaultHomeKind, data: unknown) => {
    if (kind === 'anime') {
        return Array.isArray(data)
            && data.some((section) => isRecord(section) && Array.isArray(section.videos) && section.videos.length > 0);
    }

    if (!isRecord(data)) return false;
    const home = data as { spotlight?: unknown[]; latest?: unknown[]; newManhwa?: unknown[] };
    return [home.spotlight, home.latest, home.newManhwa].some((items) => Array.isArray(items) && items.length > 0);
};

export const readPersistedVaultHome = (kind: VaultHomeKind) => {
    try {
        const raw = fs.readFileSync(getVaultHomeCacheFile(kind), 'utf8');
        const parsed = JSON.parse(raw) as Partial<PersistedVaultCache>;

        if (parsed.version !== CACHE_VERSION || !isUsableVaultHomeData(kind, parsed.data)) {
            return null;
        }

        return {
            data: parsed.data,
            updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
        };
    } catch {
        return null;
    }
};

export const writePersistedVaultHome = (kind: VaultHomeKind, data: unknown) => {
    if (!isUsableVaultHomeData(kind, data)) return;

    try {
        const cacheDir = getVaultCacheDir();
        fs.mkdirSync(cacheDir, { recursive: true });

        const file = getVaultHomeCacheFile(kind);
        const tmpFile = `${file}.${process.pid}.tmp`;
        const payload: PersistedVaultCache = {
            version: CACHE_VERSION,
            updatedAt: Date.now(),
            data,
        };

        fs.writeFileSync(tmpFile, JSON.stringify(payload));
        fs.renameSync(tmpFile, file);
    } catch (error) {
        console.warn(`[Vault] Failed to persist ${kind} home cache`, error);
    }
};
