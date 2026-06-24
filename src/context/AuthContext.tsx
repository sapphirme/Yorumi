import React, { createContext, useContext, useMemo, useState } from 'react';
import { getDeterministicAvatar } from '../utils/avatars';
import { DEFAULT_BANNER_URL, resolveStaticAssetUrl } from '../config/cloudinaryAssets';

type LocalUser = {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL?: string | null;
    metadata: {
        creationTime?: string;
    };
};

interface AuthContextType {
    user: LocalUser;
    avatar: string | null;
    banner: string | null;
    profileCardBackground: string | null;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    updateName: (name: string) => Promise<void>;
    updateAvatar: (path: string) => Promise<void>;
    updateBanner: (path: string) => Promise<void>;
    updateProfileCardBackground: (path: string) => Promise<void>;
}

const LOCAL_USER_KEY = 'yorumi_local_user';
const LOCAL_UID = 'local-desktop-user';

const createDefaultUser = (): LocalUser => ({
    uid: LOCAL_UID,
    displayName: 'Yorumi User',
    email: null,
    metadata: {
        creationTime: new Date().toISOString()
    }
});

const readLocalUser = () => {
    try {
        const raw = localStorage.getItem(LOCAL_USER_KEY);
        return raw ? { ...createDefaultUser(), ...JSON.parse(raw) } as LocalUser : createDefaultUser();
    } catch {
        return createDefaultUser();
    }
};

const writeLocalUser = (user: LocalUser) => {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
};

const readProfileAsset = (key: string, fallback: string | null) => {
    const stored = localStorage.getItem(`${key}_${LOCAL_UID}`);
    return resolveStaticAssetUrl(stored || '') || stored || fallback;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<LocalUser>(() => readLocalUser());
    const [avatar, setAvatar] = useState<string | null>(() => readProfileAsset('avatar', getDeterministicAvatar(LOCAL_UID)));
    const [banner, setBanner] = useState<string | null>(() => readProfileAsset('banner', DEFAULT_BANNER_URL));
    const [profileCardBackground, setProfileCardBackground] = useState<string | null>(() => readProfileAsset('profile_card_bg', null));

    const value = useMemo<AuthContextType>(() => ({
        user,
        avatar,
        banner,
        profileCardBackground,
        isLoading: false,
        login: async () => undefined,
        logout: async () => undefined,
        updateName: async (name: string) => {
            const nextUser = { ...user, displayName: name };
            setUser(nextUser);
            writeLocalUser(nextUser);
        },
        updateAvatar: async (path: string) => {
            setAvatar(path);
            localStorage.setItem(`avatar_${LOCAL_UID}`, path);
        },
        updateBanner: async (path: string) => {
            setBanner(path);
            localStorage.setItem(`banner_${LOCAL_UID}`, path);
        },
        updateProfileCardBackground: async (path: string) => {
            setProfileCardBackground(path);
            localStorage.setItem(`profile_card_bg_${LOCAL_UID}`, path);
        }
    }), [avatar, banner, profileCardBackground, user]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
