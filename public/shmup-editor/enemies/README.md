# Shmup Editor enemy/bullet sprites

Built-in placeholder sprites for `/shmup-editor`'s Enemy Editor (E2 #192),
referenced by `src/experiences/ShmupEditor/enemySprites.ts`. Add PNGs here
and an entry in `enemySprites.ts` to extend the built-in set.

Unlike `../tiles/` (full opaque 1254x1254 squares meant to fill a tile),
sprite art here should have a **transparent background** around the
subject — the editor's upload path (`imageUpload.ts`'s `loadSpriteImageFile`)
contain-fits an upload rather than cover-cropping it, so the whole sprite
stays visible without cutting off any of it.

| File | SHA-256 | Notes |
|---|---|---|
| `skull-buggy.png` | `984368f2e6a5ee3f114a34f7e454a5ea77432a7d5773a11f37486d2091ca51b2` | Spiked dune buggy, idle pose |
| `skull-technical.png` | `582ffc2a66051152657dbc410688c5246a9dd464b62413eed77e2253b9c204f0` | Gunner "technical" truck, idle pose |
| `skull-motorcycle.png` | `77c39ff9220e25a457e81c5c795e40e682b7e3e513092eae7ec3a2129ce4f443` | Motorcycle rider, idle pose |
| `skull-helicopter.png` | `038d391995e66be0f4b13d1efb3fc0cf688e5463dc787cd935ca00bf49475b45` | Gunship helicopter, idle pose |

The `skull-*` sprites are derived from Mad-Max-style sheets Noah supplied
(ChatGPT-generated) — see
`scripts/assets/skull-sprites-source/README.md` for the raw sheets (each a
4x4 idle/move/attack/die grid) and `scripts/prepare-skull-sprites.mjs` for
the extraction/background-removal step that produced these files. Only
the idle frame is used today; the other frames are unused pending a future
animation-preview feature (see `specs/shmup-editor.todo.md`).

Per root `CLAUDE.md`'s dependency policy, document the source and SHA-256 of
every file added here (`sha256sum <file>`), same as `../tiles/README.md`.
