import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AnimeProvider } from '../context/AnimeContext';
import { AuthProvider } from '../context/AuthContext';
import { TitleLanguageProvider } from '../context/TitleLanguageContext';


export function AppProviders({ children }: { children: ReactNode }) {
    const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';
    const Router = isElectron ? HashRouter : BrowserRouter;

    return (
        <Router>
            <AuthProvider>
                <TitleLanguageProvider>
                    <AnimeProvider>{children}</AnimeProvider>
                </TitleLanguageProvider>
            </AuthProvider>
        </Router>
    );
}
