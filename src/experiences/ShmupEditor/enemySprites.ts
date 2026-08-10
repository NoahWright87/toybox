/**
 * Built-in enemy/bullet sprites (specs/shmup-editor.todo.md, E2 #192) —
 * mirrors tileImages.ts's structure exactly. Drop additional sprite PNGs
 * into public/shmup-editor/enemies/ and add an entry below (documenting
 * source/SHA-256 in that folder's README.md per root CLAUDE.md's
 * dependency policy) to extend this list further — the editor's picker,
 * custom-upload flow, and fsStore persistence all already support it.
 *
 * Unlike a tile image (a full opaque square), a sprite is expected to have
 * a transparent surround — see imageUpload.ts's loadSpriteImageFile, which
 * contain-fits an upload instead of cover-cropping it for exactly this
 * reason.
 *
 * **The game mirrors this table.** `games/shmup/src/sprites/editorArt.ts`
 * carries the same id -> path map so the Phaser bundle can load authored
 * art directly (the two packages share no runtime code, only data shapes —
 * see specs/games/shmup/authored-encounters.spec.md). Add a sprite here and
 * add it there too, or the game falls back to a placeholder for it.
 */
export interface SpriteOption {
  id: string;
  label: string;
  /** Public path — Vite serves everything under public/ from the site root. */
  url: string | null;
}

export const NONE_SPRITE_ID = "none";

/** spriteId value meaning "use this enemy/bullet's own `customSprite` upload instead of a built-in". */
export const CUSTOM_SPRITE_ID = "custom";

export const BUILTIN_SPRITES: SpriteOption[] = [
  { id: NONE_SPRITE_ID, label: "None", url: null },
  // Parts-demo set — a body split from its turret, for testing UnitPart (see enemies/README.md).
  { id: "armored-truck-body", label: "Armored Truck (body)", url: "/shmup-editor/enemies/armored-truck-body.png" },
  { id: "armored-truck-turret", label: "Armored Truck (turret)", url: "/shmup-editor/enemies/armored-truck-turret.png" },
  { id: "battle-tank-body", label: "Battle Tank (body)", url: "/shmup-editor/enemies/battle-tank-body.png" },
  { id: "battle-tank-turret", label: "Battle Tank (turret)", url: "/shmup-editor/enemies/battle-tank-turret.png" },
  { id: "bullet-basic", label: "Bullet (basic)", url: "/shmup-editor/enemies/bullet-basic.png" },
  // "Incoming" vehicle batch (see enemies/README.md) — single-sprite vehicles.
  { id: "heli", label: "Attack Helicopter", url: "/shmup-editor/enemies/heli.png" },
  { id: "heli-transport", label: "Transport Helicopter", url: "/shmup-editor/enemies/heli-transport.png" },
  { id: "jet-bomber", label: "Jet Bomber", url: "/shmup-editor/enemies/jet-bomber.png" },
  { id: "jet-fighter", label: "Jet Fighter", url: "/shmup-editor/enemies/jet-fighter.png" },
  { id: "jet-stealth", label: "Stealth Jet", url: "/shmup-editor/enemies/jet-stealth.png" },
  { id: "motorcycle-sidecar", label: "Motorcycle + Sidecar", url: "/shmup-editor/enemies/motorcycle-sidecar.png" },
  { id: "plane-prop", label: "Prop Plane", url: "/shmup-editor/enemies/plane-prop.png" },
  { id: "truck-transport", label: "Transport Truck", url: "/shmup-editor/enemies/truck-transport.png" },
  { id: "turret", label: "Turret", url: "/shmup-editor/enemies/turret.png" },
  { id: "turret-4x", label: "Turret (quad)", url: "/shmup-editor/enemies/turret-4x.png" },
  // Multi-part "incoming" vehicles — each a body + turret pair (see enemies/README.md).
  { id: "battleship-hull", label: "Battleship (hull)", url: "/shmup-editor/enemies/battleship/hull.png" },
  { id: "battleship-turret", label: "Battleship (turret)", url: "/shmup-editor/enemies/battleship/turret.png" },
  { id: "missile-truck-body", label: "Missile Truck (body)", url: "/shmup-editor/enemies/missile-truck/body.png" },
  { id: "missile-truck-turret", label: "Missile Truck (turret)", url: "/shmup-editor/enemies/missile-truck/turret.png" },
  { id: "train-front", label: "Armored Train (front)", url: "/shmup-editor/enemies/train/front.png" },
  { id: "train-gun-car-body", label: "Armored Train (gun car body)", url: "/shmup-editor/enemies/train/gun-car-body.png" },
  { id: "train-gun-car-turret", label: "Armored Train (gun car turret)", url: "/shmup-editor/enemies/train/gun-car-turret.png" },
  { id: "train-rear", label: "Armored Train (rear)", url: "/shmup-editor/enemies/train/rear.png" },
  // Curated projectile set (see projectiles/README.md) — sprites for spawned-Unit "bullets".
  { id: "proj-bullet-tiny", label: "Bullet (tiny)", url: "/shmup-editor/projectiles/bullet-tiny.png" },
  { id: "proj-bullet-red-tip", label: "Bullet (red tip)", url: "/shmup-editor/projectiles/bullet-red-tip.png" },
  { id: "proj-bullet-tracer", label: "Bullet (tracer)", url: "/shmup-editor/projectiles/bullet-tracer.png" },
  { id: "proj-bullet-copper", label: "Bullet (copper)", url: "/shmup-editor/projectiles/bullet-copper.png" },
  { id: "proj-shell-heavy", label: "Shell (heavy)", url: "/shmup-editor/projectiles/shell-heavy.png" },
  { id: "proj-rocket-red", label: "Rocket (red)", url: "/shmup-editor/projectiles/rocket-red.png" },
  { id: "proj-rocket-gold", label: "Rocket (gold)", url: "/shmup-editor/projectiles/rocket-gold.png" },
  { id: "proj-missile-static", label: "Missile", url: "/shmup-editor/projectiles/missile-static.png" },
  { id: "proj-poison-flask", label: "Poison Flask", url: "/shmup-editor/projectiles/poison-flask.png" },
  { id: "proj-mine-spiked-ball", label: "Spiked Mine", url: "/shmup-editor/projectiles/mine-spiked-ball.png" },
  { id: "proj-cluster-shell", label: "Cluster Shell", url: "/shmup-editor/projectiles/cluster-shell.png" },
  { id: "proj-mine-morning-star", label: "Morning Star Mine", url: "/shmup-editor/projectiles/mine-morning-star.png" },
  { id: "proj-fire-orb", label: "Fire Orb", url: "/shmup-editor/projectiles/fire-orb.png" },
  { id: "proj-starburst", label: "Starburst", url: "/shmup-editor/projectiles/starburst.png" },
  { id: "proj-energy-orb-blue", label: "Energy Orb (blue)", url: "/shmup-editor/projectiles/energy-orb-blue.png" },
  { id: "proj-lightning-bolt", label: "Lightning Bolt", url: "/shmup-editor/projectiles/lightning-bolt.png" },
  { id: "proj-crystal-burst-green", label: "Crystal Burst (green)", url: "/shmup-editor/projectiles/crystal-burst-green.png" },
  { id: "proj-orb-capsule-purple", label: "Orb Capsule (purple)", url: "/shmup-editor/projectiles/orb-capsule-purple.png" },
  { id: "proj-toxic-canister", label: "Toxic Canister", url: "/shmup-editor/projectiles/toxic-canister.png" },
  { id: "proj-energy-canister-blue", label: "Energy Canister (blue)", url: "/shmup-editor/projectiles/energy-canister-blue.png" },
  // Doodad set (see doodads/README.md) — inert scenery props for the "doodad" layer.
  // Foliage — trees and bushes.
  { id: "tree-broadleaf", label: "Tree (broadleaf)", url: "/shmup-editor/doodads/foliage/broadleaf.png" },
  { id: "tree-round", label: "Tree (round canopy)", url: "/shmup-editor/doodads/foliage/round.png" },
  { id: "tree-lobed", label: "Tree (lobed)", url: "/shmup-editor/doodads/foliage/lobed.png" },
  { id: "tree-dense", label: "Tree (dense)", url: "/shmup-editor/doodads/foliage/dense.png" },
  { id: "tree-clover", label: "Tree (clover)", url: "/shmup-editor/doodads/foliage/clover.png" },
  { id: "tree-fan-palm", label: "Tree (fan palm)", url: "/shmup-editor/doodads/foliage/fan-palm.png" },
  { id: "tree-canopy-wide", label: "Tree (wide canopy)", url: "/shmup-editor/doodads/foliage/canopy-wide.png" },
  { id: "tree-cluster", label: "Tree (cluster)", url: "/shmup-editor/doodads/foliage/cluster.png" },
  { id: "tree-bush-large", label: "Bush (large)", url: "/shmup-editor/doodads/foliage/bush-large.png" },
  { id: "tree-bush-round", label: "Bush (round)", url: "/shmup-editor/doodads/foliage/bush-round.png" },
  { id: "tree-fan-palm-large", label: "Tree (fan palm, large)", url: "/shmup-editor/doodads/foliage/fan-palm-large.png" },
  { id: "tree-leafy", label: "Tree (leafy)", url: "/shmup-editor/doodads/foliage/leafy.png" },
  // Rocks and rubble.
  { id: "rock-small", label: "Rocks (small)", url: "/shmup-editor/doodads/rocks/small.png" },
  { id: "rock-boulder-pile", label: "Boulder Pile", url: "/shmup-editor/doodads/rocks/boulder-pile.png" },
  { id: "rock-twin", label: "Boulders (twin)", url: "/shmup-editor/doodads/rocks/twin.png" },
  { id: "rock-cluster", label: "Rock Cluster", url: "/shmup-editor/doodads/rocks/cluster.png" },
  { id: "rock-pebbles", label: "Pebbles (scattered)", url: "/shmup-editor/doodads/rocks/pebbles.png" },
  { id: "rock-ridge", label: "Rock Ridge", url: "/shmup-editor/doodads/rocks/ridge.png" },
  { id: "rock-field", label: "Rock Field", url: "/shmup-editor/doodads/rocks/field.png" },
  { id: "rock-slab", label: "Rock Slab", url: "/shmup-editor/doodads/rocks/slab.png" },
  { id: "rock-jagged", label: "Rocks (jagged)", url: "/shmup-editor/doodads/rocks/jagged.png" },
  { id: "rock-boulders", label: "Boulders", url: "/shmup-editor/doodads/rocks/boulders.png" },
  { id: "rock-rubble-strip", label: "Rubble Strip", url: "/shmup-editor/doodads/rocks/rubble-strip.png" },
  { id: "rock-pile", label: "Rock Pile", url: "/shmup-editor/doodads/rocks/pile.png" },
  // Desert flora and ground cover.
  { id: "desert-boulder", label: "Desert Boulder", url: "/shmup-editor/doodads/desert/boulder.png" },
  { id: "desert-sandstone", label: "Sandstone Cluster", url: "/shmup-editor/doodads/desert/sandstone.png" },
  { id: "desert-pebbles", label: "Desert Pebbles", url: "/shmup-editor/doodads/desert/pebbles.png" },
  { id: "desert-shrub-small", label: "Desert Shrub (small)", url: "/shmup-editor/doodads/desert/shrub-small.png" },
  { id: "desert-bush", label: "Desert Bush", url: "/shmup-editor/doodads/desert/bush.png" },
  { id: "desert-tumbleweed", label: "Tumbleweed", url: "/shmup-editor/doodads/desert/tumbleweed.png" },
  { id: "desert-cactus", label: "Prickly Pear Cactus", url: "/shmup-editor/doodads/desert/cactus.png" },
  { id: "desert-agave", label: "Agave", url: "/shmup-editor/doodads/desert/agave.png" },
  { id: "desert-grass-tuft", label: "Dry Grass Tuft", url: "/shmup-editor/doodads/desert/grass-tuft.png" },
  { id: "desert-bones", label: "Bones", url: "/shmup-editor/doodads/desert/bones.png" },
  { id: "desert-cracked-ground", label: "Cracked Ground", url: "/shmup-editor/doodads/desert/cracked-ground.png" },
  { id: "desert-sand-patch", label: "Sand Patch", url: "/shmup-editor/doodads/desert/sand-patch.png" },
  // Military camp — tents, earthworks, supplies.
  { id: "camp-tent-small", label: "Camp Tent (small)", url: "/shmup-editor/doodads/camp/tent-small.png" },
  { id: "camp-tent-large", label: "Camp Tent (large)", url: "/shmup-editor/doodads/camp/tent-large.png" },
  { id: "camp-sandbag-wall", label: "Sandbag Wall", url: "/shmup-editor/doodads/camp/sandbag-wall.png" },
  { id: "camp-sandbag-ring", label: "Sandbag Ring", url: "/shmup-editor/doodads/camp/sandbag-ring.png" },
  { id: "camp-foxhole", label: "Foxhole", url: "/shmup-editor/doodads/camp/foxhole.png" },
  { id: "camp-foxhole-double", label: "Foxhole (double)", url: "/shmup-editor/doodads/camp/foxhole-double.png" },
  { id: "camp-trench", label: "Trench", url: "/shmup-editor/doodads/camp/trench.png" },
  { id: "camp-netting", label: "Camo Netting", url: "/shmup-editor/doodads/camp/netting.png" },
  { id: "camp-crates", label: "Supply Crates", url: "/shmup-editor/doodads/camp/crates.png" },
  { id: "camp-barrels", label: "Fuel Barrels", url: "/shmup-editor/doodads/camp/barrels.png" },
  { id: "camp-barriers", label: "Concrete Barriers", url: "/shmup-editor/doodads/camp/barriers.png" },
  { id: "camp-sandbag-emplacement", label: "Sandbag Emplacement", url: "/shmup-editor/doodads/camp/sandbag-emplacement.png" },
  // Desert camp — the same kit in sand colors.
  { id: "camp-sand-tent-small", label: "Desert Tent (small)", url: "/shmup-editor/doodads/camp-desert/tent-small.png" },
  { id: "camp-sand-tent-large", label: "Desert Tent (large)", url: "/shmup-editor/doodads/camp-desert/tent-large.png" },
  { id: "camp-sand-netting", label: "Desert Camo Netting", url: "/shmup-editor/doodads/camp-desert/netting.png" },
  { id: "camp-sand-sandbag-wall", label: "Desert Sandbag Wall", url: "/shmup-editor/doodads/camp-desert/sandbag-wall.png" },
  { id: "camp-sand-sandbag-ring", label: "Desert Sandbag Ring", url: "/shmup-editor/doodads/camp-desert/sandbag-ring.png" },
  { id: "camp-sand-sandbag-line", label: "Desert Sandbag Line", url: "/shmup-editor/doodads/camp-desert/sandbag-line.png" },
  { id: "camp-sand-foxhole", label: "Desert Foxhole", url: "/shmup-editor/doodads/camp-desert/foxhole.png" },
  { id: "camp-sand-foxhole-double", label: "Desert Foxhole (double)", url: "/shmup-editor/doodads/camp-desert/foxhole-double.png" },
  { id: "camp-sand-trench", label: "Desert Trench", url: "/shmup-editor/doodads/camp-desert/trench.png" },
  { id: "camp-sand-crates", label: "Desert Supply Crates", url: "/shmup-editor/doodads/camp-desert/crates.png" },
  { id: "camp-sand-barrels", label: "Desert Fuel Barrels", url: "/shmup-editor/doodads/camp-desert/barrels.png" },
  { id: "camp-sand-tarp", label: "Desert Tarp", url: "/shmup-editor/doodads/camp-desert/tarp.png" },
  // Urban street furniture.
  { id: "urban-manhole", label: "Manhole Cover", url: "/shmup-editor/doodads/urban/manhole.png" },
  { id: "urban-utility-plate", label: "Utility Plate", url: "/shmup-editor/doodads/urban/utility-plate.png" },
  { id: "urban-storm-drain", label: "Storm Drain", url: "/shmup-editor/doodads/urban/storm-drain.png" },
  { id: "urban-guardrail", label: "Guardrail", url: "/shmup-editor/doodads/urban/guardrail.png" },
  { id: "urban-pipe-run", label: "Pipe Run", url: "/shmup-editor/doodads/urban/pipe-run.png" },
  { id: "urban-concrete-barriers", label: "Concrete Barrier Row", url: "/shmup-editor/doodads/urban/concrete-barriers.png" },
  { id: "urban-barricade", label: "Construction Barricade", url: "/shmup-editor/doodads/urban/barricade.png" },
  { id: "urban-warning-lights", label: "Warning Lights", url: "/shmup-editor/doodads/urban/warning-lights.png" },
  { id: "urban-street-lamp", label: "Street Lamp", url: "/shmup-editor/doodads/urban/street-lamp.png" },
  { id: "urban-bollards", label: "Bollards", url: "/shmup-editor/doodads/urban/bollards.png" },
  { id: "urban-crater", label: "Crater", url: "/shmup-editor/doodads/urban/crater.png" },
  { id: "urban-access-hatch", label: "Access Hatch", url: "/shmup-editor/doodads/urban/access-hatch.png" },
  // Industrial yard clutter.
  { id: "ind-pallet", label: "Wooden Pallet", url: "/shmup-editor/doodads/industrial/pallet.png" },
  { id: "ind-crates", label: "Wooden Crates", url: "/shmup-editor/doodads/industrial/crates.png" },
  { id: "ind-container-small", label: "Container (small)", url: "/shmup-editor/doodads/industrial/container-small.png" },
  { id: "ind-oil-barrels", label: "Oil Barrels", url: "/shmup-editor/doodads/industrial/oil-barrels.png" },
  { id: "ind-cable-spool", label: "Cable Spool", url: "/shmup-editor/doodads/industrial/cable-spool.png" },
  { id: "ind-hose-coil", label: "Hose Coil", url: "/shmup-editor/doodads/industrial/hose-coil.png" },
  { id: "ind-generator", label: "Generator", url: "/shmup-editor/doodads/industrial/generator.png" },
  { id: "ind-exhaust-fan", label: "Exhaust Fan", url: "/shmup-editor/doodads/industrial/exhaust-fan.png" },
  { id: "ind-hatch", label: "Metal Hatch", url: "/shmup-editor/doodads/industrial/hatch.png" },
  { id: "ind-oil-spill", label: "Oil Spill", url: "/shmup-editor/doodads/industrial/oil-spill.png" },
  { id: "ind-rubble", label: "Rubble", url: "/shmup-editor/doodads/industrial/rubble.png" },
  { id: "ind-tires", label: "Tire Stack", url: "/shmup-editor/doodads/industrial/tires.png" },
  // Rooftop structures — large, for flying over.
  { id: "roof-warehouse", label: "Warehouse Roof", url: "/shmup-editor/doodads/rooftops/warehouse.png" },
  { id: "roof-factory", label: "Factory Roof", url: "/shmup-editor/doodads/rooftops/factory.png" },
  { id: "roof-helipad", label: "Helipad", url: "/shmup-editor/doodads/rooftops/helipad.png" },
  { id: "roof-container-large", label: "Container (large)", url: "/shmup-editor/doodads/rooftops/container-large.png" },
  { id: "roof-container-row", label: "Container Row", url: "/shmup-editor/doodads/rooftops/container-row.png" },
  { id: "roof-tank", label: "Storage Tank", url: "/shmup-editor/doodads/rooftops/tank.png" },
  { id: "roof-tank-cluster", label: "Tank Cluster", url: "/shmup-editor/doodads/rooftops/tank-cluster.png" },
  { id: "roof-plant", label: "Plant Roof", url: "/shmup-editor/doodads/rooftops/plant.png" },
  { id: "roof-fenced-platform", label: "Fenced Platform", url: "/shmup-editor/doodads/rooftops/fenced-platform.png" },
];

export function spriteById(id: string): SpriteOption {
  return BUILTIN_SPRITES.find((s) => s.id === id) ?? BUILTIN_SPRITES[0];
}

/** Resolves the actual image URL to render, accounting for a custom upload overriding the built-in set — same pattern as types.ts's resolveTileImageUrl. */
export function resolveSpriteUrl(spriteId: string, customSprite: string | null): string | null {
  if (spriteId === CUSTOM_SPRITE_ID) return customSprite;
  return spriteById(spriteId).url;
}
