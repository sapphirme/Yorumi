const fs = require('fs');
let code = fs.readFileSync('c:/Github Repos/Yorumi/src/hooks/useStreams.ts', 'utf8');

code = code.replace(
    "{ key: 'videasy', label: 'Videasy (Fastest)' },\r\n    { key: 'auto', label: 'Default (AllManga)' },",
    "{ key: 'vidfast', label: 'Vidfast (Fastest)' },\r\n    { key: 'videasy', label: 'Videasy (Fast)' },\r\n    { key: 'auto', label: 'Default (AllManga)' },"
);

code = code.replace(
    "const isVideasy = server === 'videasy';\r\n        const effectiveSession = activeSession || (isVideasy ? 'videasy' : '');",
    "const isTmdbProvider = server === 'videasy' || server === 'vidfast';\r\n        const effectiveSession = activeSession || (isTmdbProvider ? server : '');"
);

// Fallback if \n
code = code.replace(
    "{ key: 'videasy', label: 'Videasy (Fastest)' },\n    { key: 'auto', label: 'Default (AllManga)' },",
    "{ key: 'vidfast', label: 'Vidfast (Fastest)' },\n    { key: 'videasy', label: 'Videasy (Fast)' },\n    { key: 'auto', label: 'Default (AllManga)' },"
);

code = code.replace(
    "const isVideasy = server === 'videasy';\n        const effectiveSession = activeSession || (isVideasy ? 'videasy' : '');",
    "const isTmdbProvider = server === 'videasy' || server === 'vidfast';\n        const effectiveSession = activeSession || (isTmdbProvider ? server : '');"
);


fs.writeFileSync('c:/Github Repos/Yorumi/src/hooks/useStreams.ts', code);
