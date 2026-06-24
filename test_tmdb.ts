import { tmdbService } from './src/services/tmdbService.js';

async function run() {
    const res = await tmdbService.getTvSeasonsForAnime({ 
        id: 1,
        mal_id: 1,
        title: 'Shangri-La Frontier', 
        year: 2023 
    } as any);
    console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
