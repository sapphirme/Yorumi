import { tmdbService } from './src/services/tmdbService';

async function test() {
    const anime = {
        id: 13200,
        title: "Shangri-La Frontier",
        year: 2023
    };
    
    const seasons = await tmdbService.getTvSeasonsForAnime(anime as any);
    console.log("Seasons:", seasons.map(s => ({ season_number: s.season_number, episode_count: s.episode_count })));
}
test();
