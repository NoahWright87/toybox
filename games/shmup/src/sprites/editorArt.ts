/**
 * Resolves `/shmup-editor`'s art ids to loadable URLs, and to Phaser
 * texture keys.
 *
 * The editor's art lives in the **main Doors 97 app's** `public/` tree, so
 * the deployed site serves it at `/shmup-editor/...` while this bundle is
 * served at `/shmup/`. Same origin, so an absolute path just works — no
 * copy step, no second manifest, and a custom upload (already a data URL in
 * the saved record) loads through the identical code path.
 *
 * **This table mirrors `src/experiences/ShmupEditor/enemySprites.ts` and
 * `tileImages.ts`.** It is duplicated rather than imported for the same
 * reason as `systems/encounters/authoredTypes.ts`: the two packages share
 * no runtime code, only data shapes. The ids are the contract — add a
 * sprite there, add it here. An id with no entry falls back to the game's
 * own placeholder texture rather than failing to load, so drift degrades
 * gracefully instead of blanking the screen.
 *
 * Note for `npm run dev -w @toybox/shmup`: that dev server is rooted at
 * this package, so `/shmup-editor/...` 404s there and everything renders as
 * placeholders. Authored art only resolves where the whole site is served
 * (a root `vite build` / `vite dev`, or the deployed site), which is also
 * the only place the Doors FS holds authored content in the first place.
 */

/** Where the main app serves the editor's art from, relative to the site root. */
export const EDITOR_ASSET_BASE = "/shmup-editor/";

/** `enemySprites.ts`'s NONE_SPRITE_ID / `tileImages.ts`'s NONE_IMAGE_ID — "no art", render nothing (or a placeholder). */
export const NONE_ART_ID = "none";
/** `enemySprites.ts`'s CUSTOM_SPRITE_ID / `tileImages.ts`'s CUSTOM_IMAGE_ID — use the record's own uploaded data URL instead. */
export const CUSTOM_ART_ID = "custom";

/** Editor sprite id -> path under `EDITOR_ASSET_BASE`. Mirrors `BUILTIN_SPRITES`. */
const SPRITE_PATHS: Record<string, string> = {
  // Parts-demo set — a body split from its turret.
  "armored-truck-body": "enemies/armored-truck-body.png",
  "armored-truck-turret": "enemies/armored-truck-turret.png",
  "battle-tank-body": "enemies/battle-tank-body.png",
  "battle-tank-turret": "enemies/battle-tank-turret.png",
  "bullet-basic": "enemies/bullet-basic.png",
  // Single-sprite vehicles.
  heli: "enemies/heli.png",
  "heli-transport": "enemies/heli-transport.png",
  "jet-bomber": "enemies/jet-bomber.png",
  "jet-fighter": "enemies/jet-fighter.png",
  "jet-stealth": "enemies/jet-stealth.png",
  "motorcycle-sidecar": "enemies/motorcycle-sidecar.png",
  "plane-prop": "enemies/plane-prop.png",
  "truck-transport": "enemies/truck-transport.png",
  turret: "enemies/turret.png",
  "turret-4x": "enemies/turret-4x.png",
  // Multi-part vehicles — body + turret pairs living in their own folders.
  "battleship-hull": "enemies/battleship/hull.png",
  "battleship-turret": "enemies/battleship/turret.png",
  "missile-truck-body": "enemies/missile-truck/body.png",
  "missile-truck-turret": "enemies/missile-truck/turret.png",
  "train-front": "enemies/train/front.png",
  "train-gun-car-body": "enemies/train/gun-car-body.png",
  "train-gun-car-turret": "enemies/train/gun-car-turret.png",
  "train-rear": "enemies/train/rear.png",
  // Curated projectile set.
  "proj-bullet-tiny": "projectiles/bullet-tiny.png",
  "proj-bullet-red-tip": "projectiles/bullet-red-tip.png",
  "proj-bullet-tracer": "projectiles/bullet-tracer.png",
  "proj-bullet-copper": "projectiles/bullet-copper.png",
  "proj-shell-heavy": "projectiles/shell-heavy.png",
  "proj-rocket-red": "projectiles/rocket-red.png",
  "proj-rocket-gold": "projectiles/rocket-gold.png",
  "proj-missile-static": "projectiles/missile-static.png",
  "proj-poison-flask": "projectiles/poison-flask.png",
  "proj-mine-spiked-ball": "projectiles/mine-spiked-ball.png",
  "proj-cluster-shell": "projectiles/cluster-shell.png",
  "proj-mine-morning-star": "projectiles/mine-morning-star.png",
  "proj-fire-orb": "projectiles/fire-orb.png",
  "proj-starburst": "projectiles/starburst.png",
  "proj-energy-orb-blue": "projectiles/energy-orb-blue.png",
  "proj-lightning-bolt": "projectiles/lightning-bolt.png",
  "proj-crystal-burst-green": "projectiles/crystal-burst-green.png",
  "proj-orb-capsule-purple": "projectiles/orb-capsule-purple.png",
  "proj-toxic-canister": "projectiles/toxic-canister.png",
  "proj-energy-canister-blue": "projectiles/energy-canister-blue.png",
  // Doodad set — inert scenery props.
  // Foliage — trees and bushes.
  "tree-broadleaf": "doodads/foliage/broadleaf.png",
  "tree-round": "doodads/foliage/round.png",
  "tree-lobed": "doodads/foliage/lobed.png",
  "tree-dense": "doodads/foliage/dense.png",
  "tree-clover": "doodads/foliage/clover.png",
  "tree-fan-palm": "doodads/foliage/fan-palm.png",
  "tree-canopy-wide": "doodads/foliage/canopy-wide.png",
  "tree-cluster": "doodads/foliage/cluster.png",
  "tree-bush-large": "doodads/foliage/bush-large.png",
  "tree-bush-round": "doodads/foliage/bush-round.png",
  "tree-fan-palm-large": "doodads/foliage/fan-palm-large.png",
  "tree-leafy": "doodads/foliage/leafy.png",
  // Rocks and rubble.
  "rock-small": "doodads/rocks/small.png",
  "rock-boulder-pile": "doodads/rocks/boulder-pile.png",
  "rock-twin": "doodads/rocks/twin.png",
  "rock-cluster": "doodads/rocks/cluster.png",
  "rock-pebbles": "doodads/rocks/pebbles.png",
  "rock-ridge": "doodads/rocks/ridge.png",
  "rock-field": "doodads/rocks/field.png",
  "rock-slab": "doodads/rocks/slab.png",
  "rock-jagged": "doodads/rocks/jagged.png",
  "rock-boulders": "doodads/rocks/boulders.png",
  "rock-rubble-strip": "doodads/rocks/rubble-strip.png",
  "rock-pile": "doodads/rocks/pile.png",
  // Desert flora and ground cover.
  "desert-boulder": "doodads/desert/boulder.png",
  "desert-sandstone": "doodads/desert/sandstone.png",
  "desert-pebbles": "doodads/desert/pebbles.png",
  "desert-shrub-small": "doodads/desert/shrub-small.png",
  "desert-bush": "doodads/desert/bush.png",
  "desert-tumbleweed": "doodads/desert/tumbleweed.png",
  "desert-cactus": "doodads/desert/cactus.png",
  "desert-agave": "doodads/desert/agave.png",
  "desert-grass-tuft": "doodads/desert/grass-tuft.png",
  "desert-bones": "doodads/desert/bones.png",
  "desert-cracked-ground": "doodads/desert/cracked-ground.png",
  "desert-sand-patch": "doodads/desert/sand-patch.png",
  // Military camp — tents, earthworks, supplies.
  "camp-tent-small": "doodads/camp/tent-small.png",
  "camp-tent-large": "doodads/camp/tent-large.png",
  "camp-sandbag-wall": "doodads/camp/sandbag-wall.png",
  "camp-sandbag-ring": "doodads/camp/sandbag-ring.png",
  "camp-foxhole": "doodads/camp/foxhole.png",
  "camp-foxhole-double": "doodads/camp/foxhole-double.png",
  "camp-trench": "doodads/camp/trench.png",
  "camp-netting": "doodads/camp/netting.png",
  "camp-crates": "doodads/camp/crates.png",
  "camp-barrels": "doodads/camp/barrels.png",
  "camp-barriers": "doodads/camp/barriers.png",
  "camp-sandbag-emplacement": "doodads/camp/sandbag-emplacement.png",
  // Desert camp — the same kit in sand colors.
  "camp-sand-tent-small": "doodads/camp-desert/tent-small.png",
  "camp-sand-tent-large": "doodads/camp-desert/tent-large.png",
  "camp-sand-netting": "doodads/camp-desert/netting.png",
  "camp-sand-sandbag-wall": "doodads/camp-desert/sandbag-wall.png",
  "camp-sand-sandbag-ring": "doodads/camp-desert/sandbag-ring.png",
  "camp-sand-sandbag-line": "doodads/camp-desert/sandbag-line.png",
  "camp-sand-foxhole": "doodads/camp-desert/foxhole.png",
  "camp-sand-foxhole-double": "doodads/camp-desert/foxhole-double.png",
  "camp-sand-trench": "doodads/camp-desert/trench.png",
  "camp-sand-crates": "doodads/camp-desert/crates.png",
  "camp-sand-barrels": "doodads/camp-desert/barrels.png",
  "camp-sand-tarp": "doodads/camp-desert/tarp.png",
  // Urban street furniture.
  "urban-manhole": "doodads/urban/manhole.png",
  "urban-utility-plate": "doodads/urban/utility-plate.png",
  "urban-storm-drain": "doodads/urban/storm-drain.png",
  "urban-guardrail": "doodads/urban/guardrail.png",
  "urban-pipe-run": "doodads/urban/pipe-run.png",
  "urban-concrete-barriers": "doodads/urban/concrete-barriers.png",
  "urban-barricade": "doodads/urban/barricade.png",
  "urban-warning-lights": "doodads/urban/warning-lights.png",
  "urban-street-lamp": "doodads/urban/street-lamp.png",
  "urban-bollards": "doodads/urban/bollards.png",
  "urban-crater": "doodads/urban/crater.png",
  "urban-access-hatch": "doodads/urban/access-hatch.png",
  // Industrial yard clutter.
  "ind-pallet": "doodads/industrial/pallet.png",
  "ind-crates": "doodads/industrial/crates.png",
  "ind-container-small": "doodads/industrial/container-small.png",
  "ind-oil-barrels": "doodads/industrial/oil-barrels.png",
  "ind-cable-spool": "doodads/industrial/cable-spool.png",
  "ind-hose-coil": "doodads/industrial/hose-coil.png",
  "ind-generator": "doodads/industrial/generator.png",
  "ind-exhaust-fan": "doodads/industrial/exhaust-fan.png",
  "ind-hatch": "doodads/industrial/hatch.png",
  "ind-oil-spill": "doodads/industrial/oil-spill.png",
  "ind-rubble": "doodads/industrial/rubble.png",
  "ind-tires": "doodads/industrial/tires.png",
  // Rooftop structures — large, for flying over.
  "roof-warehouse": "doodads/rooftops/warehouse.png",
  "roof-factory": "doodads/rooftops/factory.png",
  "roof-helipad": "doodads/rooftops/helipad.png",
  "roof-container-large": "doodads/rooftops/container-large.png",
  "roof-container-row": "doodads/rooftops/container-row.png",
  "roof-tank": "doodads/rooftops/tank.png",
  "roof-tank-cluster": "doodads/rooftops/tank-cluster.png",
  "roof-plant": "doodads/rooftops/plant.png",
  "roof-fenced-platform": "doodads/rooftops/fenced-platform.png",
};

/** Editor tile-image id -> path under `EDITOR_ASSET_BASE`. Mirrors `TILE_IMAGES`. */
const TILE_PATHS: Record<string, string> = {
  water: "tiles/water.png",
  grass: "tiles/grass.png",
  sand: "tiles/sand.png",
  swamp: "tiles/swamp.png",
  lava: "tiles/lava.png",
  rocky: "tiles/rocky.png",
  concrete: "tiles/concrete.png",
  forest: "tiles/forest.png",
  "grass-water": "tiles/grass-water.png",
  "grass-sand": "tiles/grass-sand.png",
  "grass-sand-natural": "tiles/grass-sand-natural.png",
  "grass-swamp": "tiles/grass-swamp.png",
  "sand-rocky": "tiles/sand-rocky.png",
  "sand-water-natural": "tiles/sand-water-natural.png",
  "sand-concrete": "tiles/sand-concrete.png",
  "sand-concrete-wall": "tiles/sand-concrete-wall.png",
  "concrete-water": "tiles/concrete-water.png",
  "concrete-water-wall": "tiles/concrete-water-wall.png",
  "concrete-lava": "tiles/concrete-lava.png",
  "concrete-lava-wall": "tiles/concrete-lava-wall.png",
  "forest-water": "tiles/forest-water.png",
  "grass-forest": "tiles/grass-forest.png",
  "grass-water-diag": "tiles/grass-water-diag.png",
  "grass-road-straight": "tiles/grass-road-straight.png",
  "grass-road-curve": "tiles/grass-road-curve.png",
  "grass-road-start": "tiles/grass-road-start.png",
  "grass-road-concrete": "tiles/grass-road-concrete.png",
};

/**
 * The URL to load for an authored sprite reference, or undefined when
 * there's nothing to load ("none", an unknown id, or "custom" with no
 * upload attached).
 */
export function editorSpriteUrl(spriteId: string, customSprite: string | null): string | undefined {
  if (spriteId === CUSTOM_ART_ID) return customSprite ?? undefined;
  const path = SPRITE_PATHS[spriteId];
  return path ? EDITOR_ASSET_BASE + path : undefined;
}

/** Same, for a tile's background art. */
export function editorTileImageUrl(imageId: string, customImage: string | null): string | undefined {
  if (imageId === CUSTOM_ART_ID) return customImage ?? undefined;
  const path = TILE_PATHS[imageId];
  return path ? EDITOR_ASSET_BASE + path : undefined;
}

/**
 * Phaser texture key for an authored sprite. Custom uploads are keyed by
 * the id of the record that owns them (a Unit or Part id) since the data
 * URL itself is far too long to use as a key and isn't shared anyway.
 */
export function editorSpriteTextureKey(spriteId: string, ownerId: string): string {
  return spriteId === CUSTOM_ART_ID ? `authored:custom:${ownerId}` : `authored:${spriteId}`;
}

export function editorTileTextureKey(imageId: string, tileId: string): string {
  return imageId === CUSTOM_ART_ID ? `authored:tile:custom:${tileId}` : `authored:tile:${imageId}`;
}

/** Every built-in sprite id this build knows how to resolve — for the drift-guard test. */
export function knownSpriteIds(): string[] {
  return Object.keys(SPRITE_PATHS);
}

export function knownTileImageIds(): string[] {
  return Object.keys(TILE_PATHS);
}
