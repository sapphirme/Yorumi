const fs = require('fs');

let p = 'c:/Github Repos/Yorumi/src/features/player/hooks/usePlayer.ts';
let code = fs.readFileSync(p, 'utf8');
code = code.replace("selectedServer !== 'videasy'", "selectedServer !== 'videasy' && selectedServer !== 'vidfast'");
fs.writeFileSync(p, code);

p = 'c:/Github Repos/Yorumi/src/features/player/components/VideoPlayer.tsx';
code = fs.readFileSync(p, 'utf8');
code = code.replace("if (key === 'videasy') return 'Videasy';", "if (key === 'vidfast') return 'Vidfast';\r\n        if (key === 'videasy') return 'Videasy';");
// Fallback
code = code.replace("if (key === 'videasy') return 'Videasy';", "if (key === 'vidfast') return 'Vidfast';\n        if (key === 'videasy') return 'Videasy';");
fs.writeFileSync(p, code);
