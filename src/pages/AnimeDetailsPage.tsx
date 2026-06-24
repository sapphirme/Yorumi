import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAnime } from '../hooks/useAnime';
import { useWatchList } from '../hooks/useWatchList';
import { useFavoriteAnime } from '../hooks/useFavoriteAnime';
import type { Anime, Episode } from '../types/anime';
import type { WatchListItem } from '../utils/storage';
import { animeService } from '../services/animeService';
import { tmdbService, type TmdbSeason, type TmdbEpisode } from '../services/tmdbService';

// Feature Components
import DetailsHero from '../features/anime/components/details/DetailsHero';
import DetailsInfo from '../features/anime/components/details/DetailsInfo';
import DetailsEpisodeGrid, { type SeasonChip } from '../features/anime/components/details/DetailsEpisodeGrid';
import DetailsVideoPlayer from '../features/anime/components/details/DetailsVideoPlayer';
import DetailsCharacters from '../features/anime/components/details/DetailsCharacters';
import DetailsTrailers from '../features/anime/components/details/DetailsTrailers';

const EpisodesSkeleton = ({ count = 10 }: { count?: number }) => (
    <div className="py-6 border-t border-white/10 mt-6">
        <h3 className="text-xl font-bold text-white mb-4">Episodes</h3>
        <div className="mt-6 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 animate-pulse">
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="aspect-square rounded bg-white/10" />
            ))}
        </div>
    </div>
);

const CharactersSkeleton = () => (
    <div className="py-6 border-t border-white/10 mt-6">
        <h3 className="text-xl font-bold text-white mb-4">Characters & Voice Actors</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="flex bg-[#1a1a1a] rounded-lg overflow-hidden border border-white/5">
                    <div className="w-16 h-24 bg-white/10" />
                    <div className="flex-1 p-2 space-y-2">
                        <div className="h-3 w-24 bg-white/10 rounded" />
                        <div className="h-3 w-16 bg-white/10 rounded" />
                    </div>
                    <div className="w-16 h-24 bg-white/10" />
                    <div className="flex-1 p-2 space-y-2">
                        <div className="h-3 w-24 bg-white/10 rounded" />
                        <div className="h-3 w-16 bg-white/10 rounded" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const TrailersSkeleton = () => (
    <div className="py-6 border-t border-white/10 mt-6">
        <h3 className="text-xl font-bold text-white mb-4">Trailers & PVs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 animate-pulse">
            <div className="relative aspect-video bg-white/10 rounded-lg overflow-hidden border border-white/10">
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/10" />
                </div>
                <div className="absolute bottom-0 inset-x-0 p-3">
                    <div className="h-3 w-28 bg-white/10 rounded" />
                </div>
            </div>
        </div>
    </div>
);

const buildInstantEpisodes = (anime: Anime | null): Episode[] => {
    if (!anime) return [];

    const metadata = Array.isArray(anime.episodeMetadata) ? anime.episodeMetadata : [];
    const metadataEpisodes = metadata.map((item, index): Episode => {
        const match = item.title?.match(/Episode\s+(\d+(?:\.\d+)?)/i);
        const episodeNumber = match?.[1] || String(index + 1);

        return {
            session: `instant:${episodeNumber}`,
            episodeNumber,
            title: item.title,
            snapshot: item.thumbnail,
        };
    });
    const latestEpisode = Number(anime.latestEpisode || 0);
    const totalEpisodes = Number(anime.episodes || 0);
    const expectedCount = Math.min(
        1500,
        Math.max(
            metadataEpisodes.length,
            Number.isFinite(latestEpisode) ? latestEpisode : 0,
            Number.isFinite(totalEpisodes) ? totalEpisodes : 0
        )
    );

    if (expectedCount <= 0) return metadataEpisodes;

    const byEpisodeNumber = new Map(metadataEpisodes.map((episode) => [episode.episodeNumber, episode]));
    return Array.from({ length: expectedCount }, (_, index) => {
        const episodeNumber = String(index + 1);
        return byEpisodeNumber.get(episodeNumber) || {
            session: `instant:${episodeNumber}`,
            episodeNumber,
        };
    });
};

type RelationNode = NonNullable<Anime['relations']>['edges'][number]['node'];

const getSeasonTitle = (item: Partial<Anime>) =>
    item.title_english || item.title || item.title_romaji || item.title_japanese || 'Unknown';

const getExplicitSeasonNumber = (item: Partial<Anime>) => {
    const title = getSeasonTitle(item);
    const match =
        title.match(/\bseason\s*(\d+)\b/i) ||
        title.match(/\b(\d+)(st|nd|rd|th)\s*season\b/i);
    return match ? Number(match[1]) : 0;
};

const getExplicitUnitNumber = (item: Partial<Anime>, unit: 'cour' | 'part') => {
    const title = getSeasonTitle(item);
    const match =
        title.match(new RegExp(`\\b${unit}\\s*(\\d+)\\b`, 'i')) ||
        title.match(new RegExp(`\\b(\\d+)(st|nd|rd|th)\\s*${unit}\\b`, 'i'));
    return match ? Number(match[1]) : 0;
};

const hasReleaseUnit = (item: Partial<Anime>, unit: 'cour' | 'part') =>
    new RegExp(`\\b${unit}\\b`, 'i').test(getSeasonTitle(item));

const isMainSeriesSeason = (item: Partial<Anime>) => {
    const format = String(item.type || '').toUpperCase();
    return format === 'TV' || format === 'TV_SHORT';
};

const getSeasonSortDate = (item: Partial<Anime>) => {
    const year = Number(item.year || item.aired?.from?.slice(0, 4) || 0);
    const month = Number(item.aired?.from?.slice(5, 7) || 0);
    return { year: year > 0 ? year : 9999, month };
};

const getSeasonSortTimestamp = (item: Partial<Anime>) => {
    const date = getSeasonSortDate(item);
    return date.year * 100 + date.month;
};

const getTmdbSeasonTimestamp = (season: TmdbSeason) => {
    const year = Number(season.air_date?.slice(0, 4) || 0);
    const month = Number(season.air_date?.slice(5, 7) || 0);
    return (year > 0 ? year : 9999) * 100 + month;
};

const mapRelationNodeToAnime = (node: RelationNode): Anime => {
    const year = Number(node.seasonYear || node.startDate?.year || 0);
    const month = Number(node.startDate?.month || 0);
    const day = Number(node.startDate?.day || 0);
    const from = year > 0
        ? `${year}-${String(month || 1).padStart(2, '0')}-${String(day || 1).padStart(2, '0')}`
        : undefined;

    return {
        mal_id: node.id,
        id: node.id,
        title: node.title.english || node.title.romaji || node.title.native || 'Unknown',
        title_english: node.title.english,
        title_romaji: node.title.romaji,
        title_japanese: node.title.native,
        images: {
            jpg: {
                image_url: node.coverImage.large,
                large_image_url: node.coverImage.large,
            },
        },
        score: 0,
        status: node.status || 'Unknown',
        type: node.format,
        episodes: node.episodes ?? null,
        year: year || undefined,
        season: node.season?.toLowerCase(),
        aired: {
            from,
            string: year ? String(year) : undefined,
        },
    };
};

const getRelatedSeasonCandidates = (anime: Anime) =>
    (anime.relations?.edges || [])
        .filter((edge) => {
            const relation = String(edge.relationType || '').toUpperCase();
            const format = String(edge.node.format || '').toUpperCase();
            return (relation === 'PREQUEL' || relation === 'SEQUEL') && (format === 'TV' || format === 'TV_SHORT');
        })
        .map((edge) => mapRelationNodeToAnime(edge.node));

const buildSeasonChips = (items: Anime[], activeId: number): SeasonChip[] => {
    const deduped = Array.from(
        items.reduce((map, item) => {
            const id = Number(item.id || 0);
            if (id > 0 && isMainSeriesSeason(item) && !map.has(id)) {
                map.set(id, item);
            }
            return map;
        }, new Map<number, Anime>()).values()
    );

    const ordered = deduped.sort((a, b) => {
        const aSeason = getExplicitSeasonNumber(a);
        const bSeason = getExplicitSeasonNumber(b);
        if (aSeason > 0 && bSeason > 0 && aSeason !== bSeason) return aSeason - bSeason;

        const aDate = getSeasonSortDate(a);
        const bDate = getSeasonSortDate(b);
        if (aDate.year !== bDate.year) return aDate.year - bDate.year;
        if (aDate.month !== bDate.month) return aDate.month - bDate.month;

        return getSeasonTitle(a).localeCompare(getSeasonTitle(b));
    });

    let currentSeason = 0;
    let offset = 0;

    return ordered.map((item, index) => {
        const explicitSeason = getExplicitSeasonNumber(item);
        const courNumber = getExplicitUnitNumber(item, 'cour');
        const partNumber = getExplicitUnitNumber(item, 'part');
        const isCour = hasReleaseUnit(item, 'cour');
        const isPart = hasReleaseUnit(item, 'part');
        const isContinuationUnit = isCour || isPart;

        if (explicitSeason > 0) {
            currentSeason = explicitSeason;
        } else if (index === 0) {
            currentSeason = 1;
        } else if (!isContinuationUnit) {
            currentSeason += 1;
        }

        const suffix = [
            isCour ? `Cour ${courNumber || 1}` : '',
            isPart ? `Part ${partNumber || 1}` : '',
        ].filter(Boolean).join(' ');
        const id = Number(item.id || 0);

        const count = item.episodes || 12; // Fallback to 12 if AniList doesn't know
        const currentOffset = offset;
        offset += count;

        return {
            id,
            label: `Season ${currentSeason}${suffix ? ` ${suffix}` : ''}`,
            title: getSeasonTitle(item),
            isActive: id === activeId,
            source: 'anilist',
            offset: currentOffset,
            count,
            anime: item
        };
    });
};

const buildTmdbSeasonChips = (items: Anime[], tmdbSeasons: TmdbSeason[], activeId: number): SeasonChip[] => {
    const orderedAnime = Array.from(
        items.reduce((map, item) => {
            const id = Number(item.id || 0);
            if (id > 0 && isMainSeriesSeason(item) && !map.has(id)) {
                map.set(id, item);
            }
            return map;
        }, new Map<number, Anime>()).values()
    ).sort((a, b) => {
        const aDate = getSeasonSortDate(a);
        const bDate = getSeasonSortDate(b);
        if (aDate.year !== bDate.year) return aDate.year - bDate.year;
        if (aDate.month !== bDate.month) return aDate.month - bDate.month;
        return getSeasonTitle(a).localeCompare(getSeasonTitle(b));
    });

    const tmdbOrdered = [...tmdbSeasons]
        .filter((season) => Number(season.season_number) > 0)
        .sort((a, b) => Number(a.season_number) - Number(b.season_number));

    if (tmdbOrdered.length === 0 || orderedAnime.length === 0) {
        return buildSeasonChips(items, activeId);
    }

    const usedAnimeIds = new Set<number>();
    let currentOffset = 0;

    return tmdbOrdered.map((season, index): SeasonChip => {
        const seasonDate = getTmdbSeasonTimestamp(season);
        const bestAnime = orderedAnime
            .filter((item) => !usedAnimeIds.has(Number(item.id || 0)))
            .sort((a, b) => {
                const aDistance = Math.abs(getSeasonSortTimestamp(a) - seasonDate);
                const bDistance = Math.abs(getSeasonSortTimestamp(b) - seasonDate);
                if (aDistance !== bDistance) return aDistance - bDistance;
                return getSeasonTitle(a).localeCompare(getSeasonTitle(b));
            })[0] || orderedAnime[index];

        const anilistId = Number(bestAnime?.id || 0);
        if (anilistId) usedAnimeIds.add(anilistId);

        const id = anilistId || season.id || (index + 1000000);

        const fallbackName = `Season ${season.season_number}`;
        const name = String(season.name || '').trim();
        const label = name && !/^season\s*\d+$/i.test(name)
            ? name
            : fallbackName;

        const count = season.episode_count || 0;
        const offset = currentOffset;
        currentOffset += count;

        return {
            id,
            label,
            title: season.name || fallbackName,
            isActive: anilistId > 0 && anilistId === activeId,
            source: 'tmdb',
            tmdbSeasonNumber: season.season_number,
            anime: bestAnime,
            anilistId,
            offset,
            count
        };
    });
};

const readRouteSeasonChips = (value: unknown, activeId: number): SeasonChip[] => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item): SeasonChip | null => {
            if (!item || typeof item !== 'object') return null;
            const record = item as Partial<SeasonChip>;
            const id = Number(record.id || 0);
            const label = String(record.label || '').trim();
            if (!id || !label) return null;

            return {
                id,
                label,
                title: String(record.title || label),
                isActive: id === activeId,
                source: record.source === 'tmdb' ? 'tmdb' : 'anilist',
                tmdbSeasonNumber: record.tmdbSeasonNumber,
                anime: record.anime as Anime,
                anilistId: record.anilistId,
                offset: record.offset,
                count: record.count,
            };
        })
        .filter((item): item is SeasonChip => Boolean(item));
};

const DetailsPageSkeleton = () => (
    <div className="min-h-screen bg-[#0a0a0a] pb-20 fade-in animate-in duration-300">
        {/* Banner Skeleton */}
        <div className="h-[40vh] md:h-[60vh] relative bg-white/5 animate-pulse">
            <div className="absolute inset-x-0 top-[72px] z-10 px-4 md:px-10">
                <div className="h-5 w-64 bg-white/10 rounded" />
            </div>
        </div>
        
        {/* Content Skeleton */}
        <div className="max-w-7xl mx-auto px-8 md:px-14 -mt-24 md:-mt-32 relative z-10">
            <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
                {/* Poster Skeleton */}
                <div className="w-48 sm:w-52 md:w-56 lg:w-60 shrink-0 bg-white/10 rounded-xl shadow-2xl border border-white/10 animate-pulse aspect-[2/3] self-center md:self-start" />
                <div className="flex-1 space-y-4">
                    <div className="h-8 w-3/4 bg-white/10 rounded animate-pulse" />
                    <div className="flex gap-4">
                        <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                    </div>
                    <div className="space-y-2 pt-4">
                        <div className="h-4 w-full bg-white/5 rounded animate-pulse" />
                        <div className="h-4 w-full bg-white/5 rounded animate-pulse" />
                        <div className="h-4 w-2/3 bg-white/5 rounded animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    </div>
);



export default function AnimeDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const animeHook = useAnime();
    const { selectedAnime, episodes, epLoading, episodesResolved, episodesBackgroundLoading, detailsLoading, error, watchedEpisodes, markEpisodeComplete, toggleEpisodeComplete } = animeHook;
    const handleAnimeClickRef = useRef(animeHook.handleAnimeClick);
    const breadcrumbParent = typeof location.state?.breadcrumbParent === 'string'
        ? location.state.breadcrumbParent
        : undefined;
    const toPositiveNumber = (value: unknown): number => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };
    const isAnimePaheSession = (value: unknown) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());

    useEffect(() => {
        handleAnimeClickRef.current = animeHook.handleAnimeClick;
    }, [animeHook.handleAnimeClick]);

    // We need to sync the URL ID with the hook's selectedAnime
    useEffect(() => {
        // Scroll to top on mount unless explicitly prevented (e.g. season navigation)
        if (!location.state?.preventScrollTop) {
            window.scrollTo({ top: 0, behavior: 'auto' });
        }

        if (!id) return;

        const routeAnime = (location.state?.anime && typeof location.state.anime === 'object')
            ? { ...(location.state.anime as Anime) }
            : null;

        if (id.startsWith('tmdb-')) {
            const tmdbId = id.substring(5).trim();
            if (!tmdbId) {
                navigate('/', { replace: true });
                return;
            }

            tmdbService.resolveTmdbToAnilist(tmdbId).then((resolved) => {
                if (resolved) {
                    handleAnimeClickRef.current(resolved);
                } else {
                    navigate('/', { replace: true });
                }
            });
            return;
        }

        if (id.startsWith('s:')) {
            const scraperSession = id.substring(2).trim();
            if (!scraperSession) {
                navigate('/', { replace: true });
                return;
            }
            const fallbackTitle = routeAnime?.title || scraperSession.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

            handleAnimeClickRef.current({
                ...(routeAnime || {}),
                id: routeAnime?.id || 0,
                mal_id: routeAnime?.mal_id || 0,
                scraperId: scraperSession,
                title: fallbackTitle,
                images: routeAnime?.images || { jpg: { image_url: '', large_image_url: '' } }
            } as Anime);
            return;
        }

        const parsedId = Number.parseInt(id, 10);
        if (Number.isFinite(parsedId) && parsedId > 0) {
            const seededAnilistId = toPositiveNumber(routeAnime?.id) || parsedId;
            const seededMalId = toPositiveNumber(routeAnime?.mal_id) || parsedId;
            handleAnimeClickRef.current({
                ...(routeAnime || {}),
                id: seededAnilistId,
                mal_id: seededMalId
            } as Anime);
        } else {
            navigate('/', { replace: true });
        }
    }, [id, location.state, navigate]);

    const { isInWatchList, addToWatchList, removeFromWatchList } = useWatchList();
    const { isFavorite, addFavorite, removeFavorite } = useFavoriteAnime();
    const instantEpisodes = useMemo(() => buildInstantEpisodes(selectedAnime), [selectedAnime]);
    const activeSeasonId = Number(selectedAnime?.id || 0);
    const initialSeasonChips = useMemo(
        () => selectedAnime ? buildSeasonChips([selectedAnime, ...getRelatedSeasonCandidates(selectedAnime)], activeSeasonId) : [],
        [activeSeasonId, selectedAnime]
    );
    const routeSeasonChips = useMemo(
        () => readRouteSeasonChips(location.state?.seasonChips, activeSeasonId),
        [activeSeasonId, location.state]
    );
    const [resolvedSeasonChips, setResolvedSeasonChips] = useState<{ activeId: number; chips: SeasonChip[] } | null>(null);
    const [tmdbSeasonChips, setTmdbSeasonChips] = useState<{ activeId: number; chips: SeasonChip[] } | null>(null);
    const selectedExplicitSeason = selectedAnime ? getExplicitSeasonNumber(selectedAnime) : 0;
    const hasCompleteRouteSeasonChips =
        routeSeasonChips.some((season) => season.source === 'tmdb') &&
        routeSeasonChips.some((season) => season.id === activeSeasonId) &&
        (selectedExplicitSeason <= 0 || routeSeasonChips.length >= selectedExplicitSeason);
    const hasIncompleteInitialSeasonChips =
        selectedExplicitSeason > 1 &&
        initialSeasonChips.length > 1 &&
        initialSeasonChips.length < selectedExplicitSeason;
    const resolvedChips = resolvedSeasonChips?.activeId === activeSeasonId ? resolvedSeasonChips.chips : [];
    const tmdbChips = tmdbSeasonChips?.activeId === activeSeasonId ? tmdbSeasonChips.chips : [];
    
    // Always prefer the longer list of seasons to ensure navigation isn't lost.
    // If TMDB merges them, tmdbChips will be shorter, so we use AniList chips.
    const seasonChips = tmdbChips.length >= resolvedChips.length && tmdbChips.length > 1
        ? tmdbChips
        : resolvedChips.length > 0
            ? resolvedChips
            : hasCompleteRouteSeasonChips
                ? routeSeasonChips
                : hasIncompleteInitialSeasonChips
                    ? []
                    : initialSeasonChips;

    const [tmdbEpisodes, setTmdbEpisodes] = useState<TmdbEpisode[]>([]);
    const [selectedTmdbSeasonNumber, setSelectedTmdbSeasonNumber] = useState<number | null>(null);

    const fallbackTmdbSeasonNumber = tmdbChips.find(c => c.isActive)?.tmdbSeasonNumber 
        ?? tmdbChips.find(c => c.tmdbSeasonNumber === selectedExplicitSeason)?.tmdbSeasonNumber
        ?? tmdbChips[0]?.tmdbSeasonNumber;

    const activeTmdbSeasonNumber = selectedTmdbSeasonNumber 
        ?? seasonChips.find(c => c.isActive && c.source === 'tmdb')?.tmdbSeasonNumber
        ?? fallbackTmdbSeasonNumber;

    useEffect(() => {
        if (!selectedAnime || !activeTmdbSeasonNumber) {
            setTmdbEpisodes([]);
            return;
        }
        let cancelled = false;
        tmdbService.getTvSeasonEpisodes(selectedAnime, activeTmdbSeasonNumber).then(eps => {
            if (cancelled) return;
            
            const activeChip = seasonChips.find(c => c.isActive);
            const isMergedOnTmdb = seasonChips.length > 1 && tmdbChips.length <= 1;

            if (isMergedOnTmdb && activeChip?.offset !== undefined && activeChip?.count !== undefined) {
                // Streambert technique: dynamically slice the massive TMDB array using the AniList offset
                setTmdbEpisodes(eps.slice(activeChip.offset, activeChip.offset + activeChip.count));
            } else {
                // TMDB often merges Cour 1 and Cour 2 into a single 24-episode season.
                // If we are viewing a "Part 2" or "Cour 2" on AniList, but the scraper gives us episodes 1-12,
                // we need to slice the TMDB episodes to only include the second half (e.g. 13-24)
                // so that the thumbnail fallback matches the correct visual episodes.
                const isPart2 = /part\s*2|cour\s*2/i.test(
                    `${selectedAnime.title} ${selectedAnime.title_english}`
                );
                
                if (isPart2 && eps.length > 15) {
                    // Approximate the slice by taking the last half, or the remaining episodes
                    // If it's a 24 ep season and we expect 12, we take the last 12.
                    const expected = selectedAnime.episodes || 12;
                    setTmdbEpisodes(eps.slice(-expected));
                } else {
                    setTmdbEpisodes(eps);
                }
            }
        });
        return () => { cancelled = true; };
    }, [selectedAnime?.id, activeTmdbSeasonNumber, selectedAnime?.episodes, seasonChips, tmdbChips.length]);

    useEffect(() => {
        if (!selectedAnime) return;

        let cancelled = false;
        const activeId = activeSeasonId;
        const initialCandidates = [selectedAnime, ...getRelatedSeasonCandidates(selectedAnime)];

        if (hasCompleteRouteSeasonChips) {
            return () => {
                cancelled = true;
            };
        }

        if (!activeId || !isMainSeriesSeason(selectedAnime)) {
            return () => {
                cancelled = true;
            };
        }

        const loadSeasonChain = async () => {
            const queue = [activeId];
            const seen = new Set<number>();
            const collected = new Map<number, Anime>();

            const collect = (item: Anime) => {
                const id = Number(item.id || 0);
                if (id > 0 && isMainSeriesSeason(item) && !collected.has(id)) {
                    collected.set(id, item);
                }
            };

            while (queue.length > 0 && seen.size < 12) {
                const currentId = queue.shift();
                if (!currentId || seen.has(currentId)) continue;
                seen.add(currentId);

                const currentAnime = currentId === activeId && selectedAnime.relations?.edges?.length
                    ? selectedAnime
                    : ((await animeService.getAnimeDetails(currentId).catch(() => ({ data: null })))?.data || (currentId === activeId ? selectedAnime : null));

                if (!currentAnime) continue;
                collect(currentAnime);

                getRelatedSeasonCandidates(currentAnime).forEach((candidate) => {
                    collect(candidate);
                    const candidateId = Number(candidate.id || 0);
                    if (candidateId > 0 && !seen.has(candidateId) && !queue.includes(candidateId)) {
                        queue.push(candidateId);
                    }
                });
            }

            if (!cancelled) {
                const collectedItems = Array.from(collected.values());
                const rootAnime = [...collectedItems].sort((a, b) => {
                    const aDate = getSeasonSortDate(a);
                    const bDate = getSeasonSortDate(b);
                    if (aDate.year !== bDate.year) return aDate.year - bDate.year;
                    if (aDate.month !== bDate.month) return aDate.month - bDate.month;
                    return getSeasonTitle(a).localeCompare(getSeasonTitle(b));
                })[0] || selectedAnime;

                setResolvedSeasonChips({
                    activeId,
                    chips: buildSeasonChips(collectedItems, activeId),
                });

                const tmdbSeasons = await tmdbService.getTvSeasonsForAnime(rootAnime).catch(() => []);
                if (!cancelled && tmdbSeasons.length > 0) {
                    setTmdbSeasonChips({
                        activeId,
                        chips: buildTmdbSeasonChips(collectedItems, tmdbSeasons, activeId),
                    });
                }
            }
        };

        loadSeasonChain().catch(() => {
            if (!cancelled) {
                setResolvedSeasonChips({
                    activeId,
                    chips: buildSeasonChips(initialCandidates, activeId),
                });
            }
        });

        return () => {
            cancelled = true;
        };
    }, [activeSeasonId, hasCompleteRouteSeasonChips, selectedAnime]);

    // Derived state for button, but useWatchList is reactive so we can just use isInWatchList(id)
    const animeId = selectedAnime
        ? (
            isAnimePaheSession(selectedAnime.scraperId)
                ? selectedAnime.scraperId
                : (selectedAnime.id || selectedAnime.mal_id)
        )?.toString() || ''
        : '';
    const inList = isInWatchList(animeId);
    const inFavorites = isFavorite(animeId);

    const addSelectedAnimeToWatchList = (status: WatchListItem['status']) => {
        if (!selectedAnime || !animeId) return;

        addToWatchList({
            id: animeId,
            anilistId: selectedAnime.id ? String(selectedAnime.id) : undefined,
            malId: selectedAnime.mal_id ? String(selectedAnime.mal_id) : undefined,
            scraperId: isAnimePaheSession(selectedAnime.scraperId) ? selectedAnime.scraperId : undefined,
            title: selectedAnime.title,
            image: selectedAnime.images.jpg.large_image_url,
            score: selectedAnime.score,
            type: selectedAnime.type,
            totalCount: selectedAnime.episodes || episodes.length,
            genres: selectedAnime.genres?.map(g => g.name),
            mediaStatus: selectedAnime.status,
            synopsis: selectedAnime.synopsis,
            status
        });
    };

    const handleToggleList = () => {
        if (!selectedAnime || !animeId) return;

        if (inList) {
            removeFromWatchList(animeId);
            return;
        }

        addSelectedAnimeToWatchList('watching');
    };

    const handleToggleFavorite = () => {
        if (!selectedAnime || !animeId) return;

        if (inFavorites) {
            removeFavorite(animeId);
        } else {
            addFavorite({
                id: animeId,
                title: selectedAnime.title,
                image: selectedAnime.images.jpg.large_image_url,
                synopsis: selectedAnime.synopsis || ''
            });
        }
    };

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-red-500 gap-4">
                <p className="text-xl font-bold">Error loading anime</p>
                <p className="text-sm text-gray-400">{error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                >
                    Go Home
                </button>
            </div>
        );
    }

    if (!selectedAnime) {
        return <DetailsPageSkeleton />;
    }

    const hasResolvedTitle = Boolean(
        selectedAnime.title?.trim() ||
        selectedAnime.title_english?.trim() ||
        selectedAnime.title_romaji?.trim() ||
        selectedAnime.title_japanese?.trim()
    );
    const hasResolvedArtwork = Boolean(
        selectedAnime.images?.jpg?.large_image_url?.trim() ||
        selectedAnime.images?.jpg?.image_url?.trim() ||
        selectedAnime.anilist_banner_image?.trim()
    );
    const shouldShowPrimarySkeleton =
        (detailsLoading && (!hasResolvedTitle || !hasResolvedArtwork)) ||
        (!hasResolvedTitle && !hasResolvedArtwork);

    if (shouldShowPrimarySkeleton) {
        return <DetailsPageSkeleton />;
    }

    const isUnreleased = selectedAnime.status === 'NOT_YET_RELEASED';
    const activeEpParam = searchParams.get('ep');
    
    const handleSeasonChipClick = (season: SeasonChip) => {
        if (season.isActive) return;
        
        if (season.source === 'tmdb' && season.tmdbSeasonNumber && (!season.anilistId || season.anilistId === activeSeasonId)) {
            setSelectedTmdbSeasonNumber(season.tmdbSeasonNumber);
            setSearchParams({}); // Clear active episode when switching TMDB seasons
            return;
        }

        const targetId = season.anilistId || season.id;
        navigate(`/anime/details/${targetId}`, {
            state: {
                anime: season.anime,
                preventScrollTop: true,
                seasonChips: seasonChips.map((chip) => ({
                    ...chip,
                    isActive: chip.id === season.id,
                })),
            },
        });
    };

    const displayChips = seasonChips.map(chip => {
        if (chip.source === 'tmdb') {
            return { ...chip, isActive: chip.tmdbSeasonNumber === activeTmdbSeasonNumber };
        }
        return chip;
    });

    const baseScraperEpisodes = episodes.length > 0 ? episodes : instantEpisodes;
    const activeChip = displayChips.find(c => c.isActive);
    let visibleEpisodes = baseScraperEpisodes;

    if (activeChip?.source === 'tmdb' && activeChip.offset !== undefined && activeChip.count !== undefined) {
        if (baseScraperEpisodes.length > activeChip.offset) {
            visibleEpisodes = baseScraperEpisodes.slice(activeChip.offset, activeChip.offset + activeChip.count);
        }
    }

    const hasEpisodes = visibleEpisodes.length > 0;
    const hasCharacters = Boolean(selectedAnime.characters?.edges?.length);
    const hasTrailers = Boolean(selectedAnime.trailer);
    const isEpisodesResolving = !hasEpisodes && (!episodesResolved || epLoading || detailsLoading || episodesBackgroundLoading);
    const expectedEpisodeCount = Number(selectedAnime.episodes || 0);
    const episodeSkeletonCount = Math.min(
        20,
        Math.max(10, Number.isFinite(expectedEpisodeCount) && expectedEpisodeCount > 0 ? expectedEpisodeCount : 10)
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a] pb-20 fade-in animate-in duration-300">
            {/* Banner Section */}
            <DetailsHero anime={selectedAnime} breadcrumbParent={breadcrumbParent} />

            {/* Content Section */}
            <div className="max-w-7xl mx-auto px-8 md:px-14 -mt-24 md:-mt-32 relative z-10">
                <DetailsInfo
                    anime={selectedAnime}
                    episodesCount={visibleEpisodes.length}
                    isLoading={isEpisodesResolving}
                    inList={inList}
                    inFavorites={inFavorites}
                    onWatch={() => {
                        setSearchParams({ ep: '1' });
                    }}
                    onToggleList={handleToggleList}
                    onToggleFavorite={handleToggleFavorite}
                >
                    {activeEpParam && animeId ? (
                        <DetailsVideoPlayer 
                            animeId={animeId} 
                            animeTitle={selectedAnime.title} 
                            onClose={() => setSearchParams({})} 
                            isWatched={watchedEpisodes.has(Number(activeEpParam))}
                            onMarkWatched={() => {
                                const epNum = Number(activeEpParam);
                                if (Number.isFinite(epNum) && epNum > 0) {
                                    toggleEpisodeComplete(epNum);
                                }
                            }}
                        />
                    ) : null}

                    {/* Episodes Section */}
                            {!isUnreleased && (
                                isEpisodesResolving ? (
                                    <EpisodesSkeleton count={episodeSkeletonCount} />
                                ) : visibleEpisodes.length > 0 ? (
                                    <DetailsEpisodeGrid
                                        episodes={visibleEpisodes}
                                        tmdbEpisodes={tmdbEpisodes}
                                        watchedEpisodes={watchedEpisodes}
                                        activeEpParam={activeEpParam}
                                        seasonChips={displayChips}
                                        onSeasonClick={handleSeasonChipClick}
                                        onEpisodeClick={(ep) => {
                                            const raw = String(ep.episodeNumber ?? '').trim();
                                            const direct = Number(raw);
                                            const matched = raw.match(/(\d+(?:\.\d+)?)/);
                                            const episodeNumber = Number.isFinite(direct) ? direct : (matched ? Number(matched[1]) : NaN);
                                            // Do not automatically mark episode as watched on click.
                                            // The user will manually click "Mark Watched" in the video player.
                                            setSearchParams({ ep: String(ep.episodeNumber) });
                                            
                                            // Ensure we scroll up to player smoothly, with a slight offset
                                            setTimeout(() => {
                                                const playerEl = document.getElementById('details-video-player');
                                                if (playerEl) {
                                                    const y = playerEl.getBoundingClientRect().top + window.scrollY - 32;
                                                    window.scrollTo({ top: y, behavior: 'smooth' });
                                                } else {
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }
                                            }, 50);
                                        }}
                                    />
                                ) : episodesResolved && !epLoading && !detailsLoading && !episodesBackgroundLoading ? (
                                    <div className="py-6 border-t border-white/10 mt-6 text-gray-500 text-center">No episodes found.</div>
                                ) : (
                                    <EpisodesSkeleton count={episodeSkeletonCount} />
                                )
                            )}

                            {/* Characters Section */}
                            {detailsLoading && !hasCharacters ? (
                                <CharactersSkeleton />
                            ) : (
                                <DetailsCharacters characters={selectedAnime.characters} />
                            )}

                            {/* Trailers Section */}
                            {detailsLoading && !hasTrailers ? (
                                <TrailersSkeleton />
                            ) : (
                                <DetailsTrailers trailer={selectedAnime.trailer} />
                            )}
                </DetailsInfo>
            </div>
        </div>
    );
}


