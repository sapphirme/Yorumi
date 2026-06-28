import React, { createContext, useContext, useState, useEffect } from 'react';

interface VaultContextType {
    isVaultUnlocked: boolean;
    unlockVault: () => void;
    lockVault: () => void;
}

const VaultContext = createContext<VaultContextType>({
    isVaultUnlocked: false,
    unlockVault: () => {},
    lockVault: () => {},
});

export const useVault = () => useContext(VaultContext);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);

    useEffect(() => {
        const stored = sessionStorage.getItem('_yrm_vlt_s');
        if (stored === 'unlocked') {
            setIsVaultUnlocked(true);
        }
    }, []);

    useEffect(() => {
        if (isVaultUnlocked) {
            sessionStorage.setItem('_yrm_vlt_s', 'unlocked');
        } else {
            sessionStorage.removeItem('_yrm_vlt_s');
        }
    }, [isVaultUnlocked]);

    const unlockVault = () => setIsVaultUnlocked(true);
    const lockVault = () => setIsVaultUnlocked(false);

    return (
        <VaultContext.Provider value={{ isVaultUnlocked, unlockVault, lockVault }}>
            {children}
        </VaultContext.Provider>
    );
};
