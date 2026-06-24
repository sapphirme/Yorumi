# 💥 THE OMNIGOD UPDATE: 103MB Desktop App Metamorphosis, TMDB Hybridization & UI Ascension 🚀

## 🚀 Overview
This PR represents a massive architectural leap, officially transitioning Yorumi from a standard web application into a fully-fledged desktop client. Alongside the platform shift, this update completely revamps the core UI/UX, overhauls backend metadata resolution, and implements robust content tracking mechanisms. 

We threw out the restrictive AniList-only structures and rebuilt the core navigation around a premium, TMDB-first hybrid architecture, creating a seamless "Netflix-like" experience for both Anime and Manga.

## 📥 Installation (Desktop App)
Since Yorumi is now a native desktop app, you no longer need to run a local development server to use it!
1. Head over to the **[Releases](../../releases)** page on GitHub.
2. Download the latest `Yorumi Setup.exe` file.
3. Run the installer to enjoy the fully-packaged desktop experience.

## 🏗️ Desktop App Metamorphosis (103MB of Pure Power)
- **Extreme Payload Optimization**: Obliterated the 800MB bloated setup file by meticulously engineering the `electron-builder` configuration to completely sever the 500MB+ `node_modules` and Chromium dependencies from the final `.asar` payload. The result is a hyper-optimized, standalone **103MB executable**.
- **Backend-in-Client Execution**: Re-architected the Express backend into a highly compressed, single-file `bundle.cjs` via `esbuild`. The app natively forks its own GUI-less runtime within the Electron environment without crashing due to standard IO pipe inheritance (`stdio: pipe`), completely bypassing Windows GUI process restrictions.
- **Dependency Elimination**: Brutally ripped out the external `dotenv` package dependency from the Electron main process, rolling a custom native-JS environment parser directly into the core to ensure perfect functionality within the completely isolated desktop environment.
- **ASAR Pathing Immunity**: Patched the backend Avatar Services and internal filesystem calls to dynamically evaluate `process.resourcesPath` when restricted inside the read-only `.asar` packaging, avoiding lethal startup crashes.
- **Automated Registry Updates**: Synced versioning (`3.0.1`) and NSIS uninstaller metadata (`UninstallDisplayName`) so the Windows OS seamlessly upgrades and reflects the correct installation footprints.

## 🎬 Massive TMDB Integration & Seasonal Navigation
- **Hybrid TMDB-First Search**: Ripped out the restrictive AniList search and integrated the TMDB `search/multi` endpoint for rapid, typo-tolerant global searching. AniList is now cleanly relegated to an on-demand resolution step.
- **Automated Seasonal Grouping**: Fixed the long-standing multi-season navigation nightmares (e.g., *One Piece*, *Mushoku Tensei*). Programmatically decomposed AniList's "absolute" episode counts into distinct, readable seasons using TMDB's `season_number` mapping.
- **Pageless Episode Grids**: Eliminated fragmented, paginated cour structures. The episode grid now loads as a single, seamless, performant layout.
- **Aggressive Caching**: Implemented highly optimized local caching (`yorumi_home_cache_v16`) to ensure episode titles, thumbnails, and metadata load instantly.

## 🎨 UI/UX Revamp & Library Overhaul
- **Consolidated Library**: Purged legacy blue-accent styling. The Library page now features full-width carousels for 'Continue Watching' and 'Continue Reading', achieving strict CSS parity with the main dashboards.
- **Sidebar Upgrades**: Anchored saved Anime/Manga lists dynamically beneath the Library icon. Implemented a custom blue-thumb scrollbar and `position: fixed` hover tooltips to prevent clipping.
- **Manga Reader Polish**: Modernized the reader UI, injected visual separator lines, and implemented floating scroll-to-top buttons.
- **Header Aesthetics**: Redesigned the "Characters & Voice Actors" sections with high-visibility, big-letter tracking and horizontal dividers to match the premium Episode sections.

## 🧠 Smart Episode Tracking & Progress Management
- **Manual Control Paradigm**: Removed the annoying automatic "mark as watched" behavior when clicking an episode chip. Clicking now *only* plays the video, giving users explicit control.
- **3-State Toggle System**: Engineered a fully cyclical tracking state (`Mark Watched` -> `Watched` -> `Unmark`).
- **Visual Progress Indicators**: `DetailsVideoPlayer` now dynamically updates to a green "Watched" state with a checkmark. In the `DetailsEpisodeGrid`, completed episodes immediately dim out with green accents, green episode text (`E1`), and checkmarks for flawless resume tracking.
- **Storage Resilience**: Added robust `unmarkEpisodeAsWatched` local storage methods to prevent ghost-progress issues.

## 🛠️ Backend & Code Health
- **Service Refactors**: Scaled up backend logic (`manga.service.ts`, `anilist.service.ts`, `scraper.service.ts`) to handle the new hybrid data flow.
- **Linting & Safety**: Purged massive swaths of unused variables, updated the Context layers to strictly type the new toggle methods, and improved overall TypeScript health.
