import { animeService } from './src/services/animeService';

async function test() {
    const queries = [
        "Mushoku Tensei: Jobless Reincarnation Season 2 Part 2",
        "Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2",
        "Jobless Reincarnation Season 2 Part 2"
    ];

    for (const q of queries) {
        console.log(`Searching: ${q}`);
        const res = await animeService.searchAllManga(q);
        console.log(res.map(r => ({ session: r.session, title: r.title, episodes: r.episodes })));
    }
}
test();
