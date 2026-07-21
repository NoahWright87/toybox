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
| `bullet-basic.png` | `c2361b8193580dcc15fcb6b34afd2e09fc8767853d771546e19abe89f9ea5606` | Generic glowing projectile — used by the default seeded "Bullet" Unit |

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

`bullet-basic.png` is a single ChatGPT-generated glow sprite Noah
supplied directly (`scripts/assets/bullet-basic-source.png`, SHA-256
`69cb8f09b6eb8f241993b63ae6433f59f50b2dece6c7aab514998a61d3c4b8b1`),
processed by `scripts/prepare-bullet-sprite.mjs` (same magenta chroma-key
pipeline, resized smaller since a bullet renders as a small icon, not a
full enemy sprite). It's what `unitTypes.ts`'s `createDefaultBulletUnit`
uses to seed a ready-to-use "Bullet" Unit — see that file and
`unitStore.ts`'s `loadUnits` for how the seed is applied.

## Incoming vehicle batch

Noah-supplied placeholder vehicle/turret art (ChatGPT-generated), processed
by `scripts/prepare-incoming-enemies.mjs` from the raw sheets in
`scripts/assets/incoming-enemies-source/` (see that folder's README for
per-file SHA-256 and notes). Same chroma-key/trim/pad/resize pipeline as
`skull-*` above, generalized to sample each sheet's own background color
(magenta for all of these except `heli.png`, which used a near-white key)
plus a connectivity-independent cleanup pass for magenta pockets fully
enclosed by opaque art (e.g. the gap between `motorcycle-sidecar.png`'s
bike and sidecar, which a border-only flood fill can't reach).

Three sheets bundle a body plus several turret variants on one canvas —
only one representative turret was extracted from each (the rest of the
sheet's variants are unused, same "idle frame only" simplification
`skull-*` already made for its unused move/attack/die rows). These three
are multi-part enemies and get their own subfolder, same reasoning as
`armored-truck-*`/`battle-tank-*` above:

| Folder | Files | Notes |
|---|---|---|
| `battleship/` | `hull.png`, `turret.png` | Ship hull + one of 8 turret variants on the source sheet |
| `missile-truck/` | `body.png`, `turret.png` | Truck body + missile-pod turret |
| `train/` | `front.png`, `gun-car-body.png`, `gun-car-turret.png`, `rear.png` | Three-car armored train — front and rear cars are single sprites, the gun car is body + one of 6 turret variants |

Flat (single-sprite, no Parts split) additions:

| File | SHA-256 | Notes |
|---|---|---|
| `heli.png` | `bd6b541f3427fb6ad1d1d35866a3c9d7e41a77f3d47a51ca881c2d93e83d6108` | Attack helicopter |
| `heli-transport.png` | `526f7e933c3cbee91d2bf5b88101ac9bd92f8f6b4a03ba2272e051bd9e14499c` | Tandem-rotor transport helicopter |
| `jet-bomber.png` | `9631bf6623c5ad43637d235b692c665c4327424de7e723c15db721c1b8f6b1bc` | Delta-wing jet bomber |
| `jet-fighter.png` | `ca4f7d94c5b6e0ea6a9d4b0e529c2690c5ea736a10baeb8d38cbc8eec2a67e37` | Swing-wing jet fighter |
| `jet-stealth.png` | `d40480e701f04bb7f3fbf31abf696951c0e9d282baaf725e5b16812defd6c1b0` | Stealth fighter |
| `motorcycle-sidecar.png` | `2c89fd04298f9641a55e7357fcf0f2d5845ad19116ab2d2907c6bcceacafedd4` | Motorcycle + gunner sidecar, fused sprite |
| `plane-prop.png` | `6d13283cbbb926a133834be352ff966aa87f266a61cb4dfea4ada1aa62d9de4f` | Propeller bomber |
| `truck-transport.png` | `486d27b83f1855af7d53eb023245142373b31a8a91e1e28eccbbffc5f8f9289c` | Canvas-back transport truck |
| `turret.png` | `5fda0b107108c1eb5c14b39e37de959f9cdfd9eaa83286336dcfa76f60d3045c` | Single-barrel stationary turret |
| `turret-4x.png` | `6c3b1b437e0321ca8e0c1c0c6f8a00bc8cf9ed555f9ffeb2e1e52075d01ab7d5` | Quad-barrel stationary turret |

And in `battleship/`/`missile-truck/`/`train/` (SHA-256 of the processed,
transparent-background output — the source sheet's own hash is in
`scripts/assets/incoming-enemies-source/README.md`):

| File | SHA-256 |
|---|---|
| `battleship/hull.png` | `c648ca6a660b7eb016d5653e4e2cbc2d5ee7559829cb9d67592423424236168f` |
| `battleship/turret.png` | `bbc02bab2a3ea1c7c914b53d6ddd65bfefaffb18e92ed41c3ded42a69c744e47` |
| `missile-truck/body.png` | `ae371e4e306755f989625ccaec16e1baea3072f4050a6003ee8c286cef746878` |
| `missile-truck/turret.png` | `e1d466782b6de9d9f196e608d3e5136298f0cad5961b041659f3acf6df26a5d1` |
| `train/front.png` | `a78a331e826d26d03ee445937e84e3ca5d2e8dba7ddd8032640e3698051a6422` |
| `train/gun-car-body.png` | `9d3d18a5660d9f6974d0f66f7285b2897dcc4cddfdbe14ef40b840482450a421` |
| `train/gun-car-turret.png` | `78a1c4b0e127e8a591ac4f3c1b26d78102244b109a66768778bd8b2a5e3e0a30` |
| `train/rear.png` | `d0296714f046bb9d026eb87f21ab54ffe34c594ad00826b8c3dbe0164cafd480` |

Per root `CLAUDE.md`'s dependency policy, document the source and SHA-256 of
every file added here (`sha256sum <file>`), same as `../tiles/README.md`.
