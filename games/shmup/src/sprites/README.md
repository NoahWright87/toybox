# SHMUP Sprites — Registry & Asset Pipeline

**Gameplay never blocks on art.** Every entity renders as a colored
placeholder primitive from the moment it's added; pointing its manifest
entry at a real PNG swaps the art with **zero code changes**.

Design rationale lives in
[`specs/games/shmup/content-and-assets.spec.md`](../../../../specs/games/shmup/content-and-assets.spec.md).
This file is the practical how-to for adding sprites and art.

## The rule: code references a key, never a path or a draw call

```ts
import { preloadSprites, ensurePlaceholderTextures } from "../sprites";

class SomeScene extends Phaser.Scene {
  preload() {
    preloadSprites(this); // queues any real art that already exists
  }
  create() {
    ensurePlaceholderTextures(this); // fills in primitives for everything else
    this.add.image(x, y, "enemyDrone"); // sprite key — same key whether it's art or a primitive
  }
}
```

`enemyDrone` (or any sprite key) is just a Phaser texture key once
`preload`/`create` have run — there's no special API for drawing it.
Nothing outside `sprites/` should call `scene.add.graphics()...generateTexture()`
or `scene.load.image()` with a literal path for a game entity.

## Adding a new sprite

1. Pick a camelCase key (e.g. `enemyTurret`) and add an entry to
   [`manifest.json`](./manifest.json):
   ```json
   "enemyTurret": {
     "category": "enemies",
     "path": "enemies/enemy_turret_idle_01.png",
     "frameWidth": 64,
     "frameHeight": 64,
     "frameCount": 1,
     "frameDuration": 100,
     "placeholder": { "shape": "circle", "color": "#aa3355" }
   }
   ```
2. Reference `"enemyTurret"` by key wherever you'd spawn it. It's visible
   immediately as a colored circle — **no art required** to keep working.
3. When art exists, drop the PNG at `assets/sprites/enemies/enemy_turret_idle_01.png`
   and rebuild/reload. No code changes — `preloadSprites` picks it up because
   `path` already pointed there.

`SpriteKey` (exported from `./registry`) is `keyof` the manifest, so a typo
in a sprite key is a compile error anywhere it's used as a `SpriteKey`.

## Folder structure & naming convention

```
src/assets/sprites/
  ships/         player & allied craft
  enemies/       hostiles, from drones up to bosses
  effects/       explosions, impacts, ambient particles (stars, trails)
  projectiles/   bullets, missiles, beams
```

File names are tooling-readable for the external art workflow:
`{category-singular}_{name}_{state}_{frame}.png`, e.g.
`enemy_drone_idle_01.png`, `ship_player_fire_02.png`. Zero-padded two-digit
frame numbers (`_01`, `_02`, …) so a batch sorts and globs correctly.

## Fixed canvas sizes

Recommended defaults per category (`CATEGORY_DEFAULT_SIZE` in `types.ts`),
used as the starting point for new art:

| Category | Default size |
|---|---|
| `projectiles` | 32×32 |
| `ships` | 64×64 |
| `enemies` | 64×64 (bosses: 128×128 — set `frameWidth`/`frameHeight` explicitly) |
| `effects` | 64×64 |

The manifest's `frameWidth`/`frameHeight` are always authoritative — the
table above is guidance for new entries, not validated at runtime. (The
four scaffold sprites carried over from the original `PlayScene` prototype
keep their original non-standard sizes rather than being resized, to avoid
an unrelated gameplay/hitbox change.)

## Multi-frame sprites

`frameCount` + `frameDuration` describe a horizontal spritesheet at `path`
(`frameWidth * frameCount` px wide). Set `frameCount` to 1 for a static
image. Until real art exists, a multi-frame entry still falls back to a
single static placeholder frame — animation only activates once a real
spritesheet PNG is present.

## External (ChatGPT-generated) art workflow

1. Generate a batch with a consistent palette per batch; export PNG with
   real alpha.
2. Drop files into the matching `assets/sprites/{category}/` folder using
   the naming convention above.
3. Update the `path` (and `frameWidth`/`frameHeight`/`frameCount` if it's a
   sheet) on the matching manifest entries.
4. That's it — no code changes. **Sprite Studio** (planned) will become the
   cleanup/palette-correction + sheet-assembly pass between steps 1 and 2;
   keep the manifest format friendly to that (flat key → metadata, one
   entry per logical sprite, frame count/duration already first-class).

## FS-override hook

A player (or Noah, hacking the fake OS) can drop a PNG at
`C:\Programs\Games\SHMUP\Sprites\{category}\{file}.png` in the Doors 97
virtual filesystem (via NS Art's save flow, or by editing the FS directly)
to override a bundled sprite without touching the build — same
path-based-wins convention as `Hellzone/assetOverride.ts` and
`MahjongSolitaire/mahjongAssets.ts`. See `fsOverride.ts` for why this is a
self-contained read-only peek at the shared `ns97_fs_v1` localStorage key
rather than an import of the live `fsStore` singleton (SHMUP is a
separately-built bundle, not part of the Doors 97 React app).

## Bundled art attribution

Binary assets carry no supply-chain risk in the npm sense (root `CLAUDE.md`'s
dependency policy), but the source/hash is documented here per that policy:

| File | Source | SHA-256 |
|---|---|---|
| `effects/fx_bg_ground_01.png` | Noah-provided reference art (dirt/ground 4x4 tileset), cropped to 16 gutter-free 96×96 tiles and reassembled into one sheet for `sprites/manifest.json`'s `bgGround` entry | `6183b7ca3780d872af4d40c0172f302d54f8bc48b227a1e5d37aa9faf1338104` |

## Module map

| File | Job |
|---|---|
| `types.ts` | `SpriteCategory`, manifest entry shape, category default sizes |
| `manifest.json` | The actual key → metadata data. Edit this to add/change sprites. |
| `placeholders.ts` | Draws a manifest entry's primitive (rect/circle/triangle) |
| `assetSource.ts` | Resolves a manifest `path` to a loadable URL (FS override → bundled PNG → undefined) |
| `fsOverride.ts` | The FS-override read path |
| `registry.ts` | `preloadSprites`/`ensurePlaceholderTextures`/`spriteDef`/`spriteKeys` — the Phaser-facing API |
| `index.ts` | Public barrel — import from `../sprites`, not individual files |
