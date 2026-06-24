const { AllMangaScraper } = require('./backend/src/api/scraper/allmanga/allmanga.scraper');

async function test() {
    const scraper = new AllMangaScraper();
    // Mushoku Tensei Season 2 Part 2 title
    const searchResult = await scraper.search('Mushoku Tensei: Jobless Reincarnation Season 2 Part 2');
    console.log("Search Result:", searchResult.slice(0, 3));
    
    if (searchResult.length > 0) {
        const id = searchResult[0].id;
        const eps = await scraper.getEpisodes(id);
        console.log(`Episodes for ${id}:`, eps.slice(0, 3), "...", eps.slice(-3));
    }
}
test();
