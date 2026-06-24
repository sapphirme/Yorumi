async function test() {
    const res = await fetch("https://api.themoviedb.org/3/search/tv?query=Shangri-La+Frontier&api_key=428ec4b967ff3a33cae235804561081d");
    const data = await res.json();
    const id = data.results[0].id;
    
    const details = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=428ec4b967ff3a33cae235804561081d`);
    const detailsData = await details.json();
    
    console.log(detailsData.seasons.map(s => ({ season_number: s.season_number, episode_count: s.episode_count })));
}
test();
