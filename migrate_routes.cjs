const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('./src', function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('/anime/watch/')) {
            console.log('Replacing in', filePath);
            // We want to replace `/anime/watch/${title}/` with `/anime/details/`
            // Sometimes it's navigate(`/anime/watch/${title}/${id}...`)
            // We need to change the route completely.
            
            // Actually, `/anime/details/` ONLY takes the ID, not the title!
            // Wait! The URL pattern for WatchPage was `/anime/watch/:title/:id`.
            // AnimeDetailsPage is `/anime/details/:id`.
            // So we need to strip `${title}/` from the navigate strings!
            
            // Example: navigate(`/anime/watch/${title}/${id}?ep=1`)
            // Should become: navigate(`/anime/details/${id}?ep=1`)
            
            // Regex to find `/anime/watch/${[^}]+}/`
            let newContent = content.replace(/\/anime\/watch\/\$\{[^}]+\}\//g, '/anime/details/');
            
            // Let's also handle `/anime/watch/' + title + '/'` just in case, though template literals are mostly used.
            
            // Also need to check if there are other occurrences like `location.pathname.startsWith('/anime/watch/')`
            newContent = newContent.replace(/\/anime\/watch\//g, '/anime/details/');
            
            if (content !== newContent) {
                fs.writeFileSync(filePath, newContent, 'utf8');
            }
        }
    }
});
