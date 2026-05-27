import { AnimatePresence, m } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AnimeDetailsPage from '../pages/AnimeDetailsPage';
import AnimeFormatPage from '../pages/AnimeFormatPage';
import ContinueWatchingPage from '../pages/ContinueWatchingPage';
import FavoriteAnimePage from '../pages/FavoriteAnimePage';
import FavoriteMangaPage from '../pages/FavoriteMangaPage';
import GenrePage from '../pages/GenrePage';
import HomePage from '../pages/HomePage';
import MangaContinueReadingPage from '../pages/MangaContinueReadingPage';
import MangaDetailsPage from '../pages/MangaDetailsPage';
import MangaFormatPage from '../pages/MangaFormatPage';
import MangaGenrePage from '../pages/MangaGenrePage';
import MangaPage from '../pages/MangaPage';
import MangaReaderPage from '../pages/MangaReaderPage';
import MangaReadListPage from '../pages/MangaReadListPage';
import ProfilePage from '../pages/ProfilePage';
import SearchPage from '../pages/SearchPage';
import UserProfilePage from '../pages/UserProfilePage';
import UserSearchPage from '../pages/UserSearchPage';
import WatchListPage from '../pages/WatchListPage';
import WatchPage from '../pages/WatchPage';
import YumiPage from '../pages/YumiPage';
import { pageTransitionVariants } from '../utils/motion';

export function AppRoutes() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <m.main
                key={location.pathname}
                variants={pageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="relative z-10"
            >
                <Routes location={location}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/anime/popular" element={<AnimeFormatPage />} />
                    <Route path="/anime/movies" element={<AnimeFormatPage />} />
                    <Route path="/anime/tv" element={<AnimeFormatPage />} />
                    <Route path="/anime/ova" element={<AnimeFormatPage />} />
                    <Route path="/anime/ona" element={<AnimeFormatPage />} />
                    <Route path="/anime/specials" element={<AnimeFormatPage />} />
                    <Route path="/anime/details/:id" element={<AnimeDetailsPage />} />
                    <Route path="/anime/watch/:title/:id" element={<WatchPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/manga" element={<MangaPage />} />
                    <Route path="/manga/details/:id" element={<MangaDetailsPage />} />
                    <Route path="/manga/read/:title/:id/:chapter" element={<MangaReaderPage />} />
                    <Route path="/genre/:name" element={<GenrePage />} />
                    <Route path="/manga/genre/:name" element={<MangaGenrePage />} />
                    <Route path="/manga/popular" element={<MangaFormatPage />} />
                    <Route path="/manga/latest" element={<MangaFormatPage />} />
                    <Route path="/manga/directory" element={<MangaFormatPage />} />
                    <Route path="/manga/new" element={<MangaFormatPage />} />
                    <Route path="/manga/manhwa" element={<MangaFormatPage />} />
                    <Route path="/manga/one-shot" element={<MangaFormatPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/users" element={<UserSearchPage />} />
                    <Route path="/yumi" element={<YumiPage />} />
                    <Route path="/user/:uid" element={<UserProfilePage />} />
                    <Route path="/anime/continue-watching" element={<ContinueWatchingPage />} />
                    <Route path="/anime/watch-list" element={<WatchListPage />} />
                    <Route path="/anime/favorites" element={<FavoriteAnimePage />} />
                    <Route path="/manga/continue-reading" element={<MangaContinueReadingPage />} />
                    <Route path="/manga/read-list" element={<MangaReadListPage />} />
                    <Route path="/manga/favorites" element={<FavoriteMangaPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </m.main>
        </AnimatePresence>
    );
}
