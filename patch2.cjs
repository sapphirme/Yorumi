const fs = require('fs');

const file = 'c:\\Github Repos\\Yorumi\\src\\context\\AnimeContext.tsx';
let content = fs.readFileSync(file, 'utf8');

// Bust EPISODE_CACHE_PREFIX
content = content.replace(/EPISODE_CACHE_PREFIX = 'yorumi_ep_cache_v3'/g, "EPISODE_CACHE_PREFIX = 'yorumi_ep_cache_v4'");

// Bust MAPPING_CACHE_PREFIX or whatever the string is
content = content.replace(/yorumi_mapping_v/g, "yorumi_mapping_v2_");

fs.writeFileSync(file, content);
