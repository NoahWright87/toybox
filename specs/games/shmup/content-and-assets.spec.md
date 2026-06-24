# Shmup — Sprite Registry & Asset Pipeline Spec

> Issue: **F5 #133**. Implemented in `games/shmup/src/sprites/` (+
> `assets/sprites/`). Status: current, shippable behavior. (The copy/content
> registry, F2 #130, is a separate concern — see
> `content-and-assets.spec.todo.md`.)

## Core principle: gameplay never blocks on art

Every entity renders as a colored placeholder primitive (rect/circle/
triangle), color-coded by faction/type, from the moment it's added. No PNG
is required to make a new entity visible and playable. Pointing a sprite's
manifest entry at a real PNG swaps the art with a data-only change — no
code change.

## The registry

Code references a sprite **key** (e.g. `"enemyDrone"`), never a hardcoded
draw call or file path:

```ts
preloadSprites(scene);            // preload(): queues any real art that exists
ensurePlaceholderTextures(scene); // create(): fills in primitives for the rest
this.add.image(x, y, "enemyDrone"); // sprite key == Phaser texture key
```

`SpriteKey` is `keyof` the manifest, so referencing an undeclared key is a
compile error.

## The manifest (`manifest.json`)

A flat `Record<SpriteKey, SpriteManifestEntry>` is the single wiring layer.
Each entry declares: `category`, `path` (relative to `assets/sprites/`),
`frameWidth`/`frameHeight`, `frameCount`, `frameDuration` (ms/frame, used
once `frameCount > 1`), and a `placeholder` (`shape` + `color`) used until
real art exists at `path`. Dropping a PNG into `assets/sprites/{category}/`
and pointing `path` at it requires zero code changes — `preloadSprites`
picks it up automatically.

## Folder structure & naming

```
assets/sprites/
  ships/         player & allied craft
  enemies/       hostiles, drones through bosses
  effects/       explosions, impacts, ambient particles
  projectiles/   bullets, missiles, beams
```

Naming: `{category-singular}_{name}_{state}_{frame}.png` with zero-padded
two-digit frame numbers, e.g. `enemy_drone_idle_01.png`,
`ship_player_fire_02.png`.

## Fixed canvas sizes

Recommended defaults per category (`CATEGORY_DEFAULT_SIZE`): 32×32
projectiles, 64×64 ships/enemies/effects, 128×128 bosses (set
`frameWidth`/`frameHeight` explicitly on boss entries). The manifest's
declared dimensions are always authoritative; the table is guidance for new
entries, not a runtime-validated rule. Legacy placeholder-only sprites
carried over from the original prototype slice keep their original
non-standard sizes rather than being resized.

## FS-override hook

A non-empty file in the Doors 97 virtual filesystem at
`C:\Programs\Games\SHMUP\Sprites\{category}\{file}.png` wins over the
bundled asset at the matching manifest `path` — the same path-based-wins
convention as `Hellzone/assetOverride.ts` and
`MahjongSolitaire/mahjongAssets.ts`. Resolution order per sprite: FS
override → bundled PNG (if one exists in `assets/sprites/`) → colored
placeholder primitive.

SHMUP is a separately-built Vite bundle served full-page at `/shmup/` (not
embedded in the Doors 97 React app), so it can't import the live `fsStore`
singleton without pulling the whole Doors 97 app into its bundle. Instead
it does a read-only peek at the same `ns97_fs_v1` localStorage key both
apps share, mirroring the relevant slice of `FileSystemStore`'s path
traversal. SHMUP never writes through this path. The `Sprites/` folder (and
its four category subfolders) under `C:\Programs\Games\SHMUP\` is seeded in
the main app's `seed.ts`/`migrate()` so it's discoverable from the file
browser.

## External (ChatGPT-generated) art workflow

Noah generates a batch with a consistent palette and real alpha, drops the
files into the matching `assets/sprites/{category}/` folder, and updates
the affected manifest entries' `path` (and frame fields, if it's a sheet).
No code changes.

## Multi-frame sprites

`frameCount` + `frameDuration` describe a horizontal spritesheet
(`frameWidth * frameCount` px wide) at `path`. Until a real spritesheet PNG
exists, a multi-frame entry still falls back to a single static placeholder
frame — animation only activates once real art is present.

## Future: Sprite Studio

See `content-and-assets.spec.todo.md` — Sprite Studio is the planned
cleanup/palette-correction + sheet-assembly pass between an AI-generated
batch and dropping files into `assets/sprites/`. The manifest format (flat
key → metadata, frame count/duration already first-class) is kept friendly
to that.

## Related

- [`overview.spec.todo.md`](./overview.spec.todo.md)
- [`content-and-assets.spec.todo.md`](./content-and-assets.spec.todo.md) — copy/content registry (F2)
- `src/experiences/Hellzone/sprites.ts` / `assetOverride.ts` — the precedent this design reuses
- `src/experiences/MahjongSolitaire/mahjongAssets.ts` — the other existing FS-override precedent
