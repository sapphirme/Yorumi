const normalizeTitle = (value) =>
    String(value || '')
        .toLowerCase()
        .replace(/\bseason\s*\d+\b/gi, ' ')
        .replace(/\b\d+(st|nd|rd|th)\s*season\b/gi, ' ')
        .replace(/\bcour\s*\d+\b/gi, ' ')
        .replace(/\bpart\s*\d+\b/gi, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '');

const titles = [
    "Shangri-La Frontier 2nd Season",
    "Shangri-La Frontier: Kusoge Hunter, Kamige ni Idoman to su 2nd Season",
    "Tensei Shitara Slime Datta Ken 3rd Season",
    "Wistoria: Wand and Sword Season 2",
    "Mushoku Tensei: Jobless Reincarnation Season 2 Part 2"
];

console.log(titles.map(t => ({ original: t, normalized: normalizeTitle(t) })));
