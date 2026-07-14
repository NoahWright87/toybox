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
| `armored-truck-body.png` | `d78776134a769b3b940c9a622006c48452ce442314c88976530ebb97bf52a9ae` | Armored truck hull (Parts-demo, no turret) |
| `armored-truck-turret.png` | `2edda25066eaa9ad649ae446a6db0a3d408a97e7aafa69c737ceb47c066d4a6e` | Armored truck's roof-mounted MG turret (Parts-demo) |
| `battle-tank-body.png` | `3b364ea2a6653229c35668758c5211a9aee055d9944f737d32b213741b2a544d` | Tank hull (Parts-demo, no turret) |
| `battle-tank-turret.png` | `18962898bfb5e6793137c59f3a26bf4672dd777a29decb1c0f1e5853cb6e7482` | Tank's rotating cannon turret (Parts-demo) |

The `skull-*` sprites are derived from Mad-Max-style sheets Noah supplied
(ChatGPT-generated) — see
`scripts/assets/skull-sprites-source/README.md` for the raw sheets (each a
4x4 idle/move/attack/die grid) and `scripts/prepare-skull-sprites.mjs` for
the extraction/background-removal step that produced these files. Only
the idle frame is used today; the other frames are unused pending a future
animation-preview feature (see `specs/shmup-editor.todo.md`).

The `armored-truck-*`/`battle-tank-*` sprites are a **body split from its
turret**, purpose-built for testing the multi-Part Unit system (a
`UnitPart` needs its own sprite to be a meaningful standalone test case) —
see `scripts/assets/parts-demo-sprites-source/README.md` for the raw
"body + turret on one sheet" sources and
`scripts/prepare-parts-demo-sprites.mjs` for the chroma-key/split step.
These aren't part of a matched vehicle family the way `skull-*` is (no
idle/move/attack/die animation states) — they're reference art for
exercising Parts, not a polished built-in enemy set.

Per root `CLAUDE.md`'s dependency policy, document the source and SHA-256 of
every file added here (`sha256sum <file>`), same as `../tiles/README.md`.
