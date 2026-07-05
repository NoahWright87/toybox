# Shmup Editor enemy/bullet sprites

Built-in placeholder sprites for `/shmup-editor`'s Enemy Editor (E2 #192),
referenced by `src/experiences/ShmupEditor/enemySprites.ts`. Empty for now —
no sprite art has been supplied yet, only the "None" built-in. Add PNGs here
and an entry in `enemySprites.ts` to extend the built-in set.

Unlike `../tiles/` (full opaque 1254x1254 squares meant to fill a tile),
sprite art here should have a **transparent background** around the
subject — the editor's upload path (`imageUpload.ts`'s `loadSpriteImageFile`)
contain-fits an upload rather than cover-cropping it, so the whole sprite
stays visible without cutting off any of it.

| File | SHA-256 | Notes |
|---|---|---|
| _(none yet)_ | | |

Per root `CLAUDE.md`'s dependency policy, document the source and SHA-256 of
every file added here (`sha256sum <file>`), same as `../tiles/README.md`.
