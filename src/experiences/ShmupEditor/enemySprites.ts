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
];

export function spriteById(id: string): SpriteOption {
  return BUILTIN_SPRITES.find((s) => s.id === id) ?? BUILTIN_SPRITES[0];
}

/** Resolves the actual image URL to render, accounting for a custom upload overriding the built-in set — same pattern as types.ts's resolveTileImageUrl. */
export function resolveSpriteUrl(spriteId: string, customSprite: string | null): string | null {
  if (spriteId === CUSTOM_SPRITE_ID) return customSprite;
  return spriteById(spriteId).url;
}
