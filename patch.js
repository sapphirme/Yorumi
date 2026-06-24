const fs = require('fs');

const file = 'c:\\Github Repos\\Yorumi\\src\\features\\anime\\components\\details\\DetailsEpisodeGrid.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /const direct = parseFloat\(ep\.episodeNumber\);/,
    "const direct = ep._tmdbAbsolute ?? parseFloat(ep.episodeNumber);"
);

content = content.replace(
    /label={`E\${tmdbEp\?\.episode_number \|\| ep\.episodeNumber}`}/,
    "label={`E${ep.episodeNumber}`}"
);

fs.writeFileSync(file, content);
