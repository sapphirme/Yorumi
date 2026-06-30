# Yorumi v3.5.1

Release date: June 30, 2026

## Summary

Yorumi v3.5.1 is a patch release focused on manga source resolution reliability. It fixes a MangaKatana mismatch where an AniList manga detail page could resolve to an unrelated MangaKatana title when the English title search returned broad or single-word matches.

The main user-visible fix is for titles such as **More Than a Married Couple, but Not Lovers.**, which now resolves to the canonical MangaKatana entry **Fuufu Ijou, Koibito Miman.** with the full available chapter list instead of a wrong one-shot-style result.

## Fixed

- Fixed MangaKatana resolver accepting weak partial title matches.
- Prevented very short MangaKatana titles, such as one-word matches, from matching long AniList titles only because they share a common word.
- Fixed numeric AniList manga detail routes so they resolve through known AniList title aliases before hydrating MangaKatana chapters.
- Added validation for existing AniList-to-MangaKatana mappings before reusing them.
- Invalid stale mappings are now discarded when the MangaKatana title or alternate names do not match the AniList title set closely enough.
- Bumped manga hydrated-details and title-resolution cache namespaces so old bad cached resolver results are not reused.
- Improved frontend manga fallback search order so full known titles and aliases are attempted before shortened titles or keyword-only searches.

## Technical Details

- The manga resolver now compares MangaKatana titles and alternate names against all useful AniList title candidates:
  - English title
  - Romaji title
  - Native title
  - Latin synonyms
  - Other known synonyms
- Partial title matching now requires a meaningful overlap:
  - At least three title words on the shorter side.
  - The shorter normalized title must be at least 60% of the longer normalized title.
- Resolver acceptance now requires high-confidence title scoring instead of accepting loose overlap.
- Cached resolver hits are revalidated against live MangaKatana details before being reused.
- Numeric AniList IDs now resolve to MangaKatana scraper IDs inside the hydrated manga details path before chapter hydration.

## Verified

- Confirmed AniList manga ID `105011` resolves to MangaKatana ID `fuufu-ijou-koibito-miman.21651`.
- Confirmed the resolved MangaKatana title is `Fuufu Ijou, Koibito Miman.`
- Confirmed the resolved chapter list returns 85 chapters, with Chapter 79 as the newest chapter.
- `npm run build --prefix backend` completed successfully.
- `npx tsc -p tsconfig.app.json --noEmit` completed successfully.

## Known Notes

- `npm run lint` still reports existing repo-wide lint issues unrelated to this release, including generated `backend/dist` lint errors and pre-existing `no-explicit-any` violations.
- This release does not change scraper routes, app ports, Vault navigation behavior, or MangaKatana chapter/page API contracts.

## Version

- Previous app version: `3.5.0`
- New app version: `3.5.1`
- Backend package version remains: `1.0.0`
