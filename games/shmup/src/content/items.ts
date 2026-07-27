/**
 * Passive item registry (items-and-brands.spec.todo.md). Items are modifier
 * bundles over the shared stat pool — pure data run through the F4 effect-
 * composition engine, same as weapons. C3 #142/C4 #143 own growing this into
 * the real item catalog; this is a small starter set spanning both brands
 * (dodge/speed for Grease Monkey Oil, Hype-on-damage-flavored survivability
 * for Masochist Energy Drink) plus unbranded generics, across all four
 * rarity tiers, so the F9 shop/offer system has real stock to draw from.
 */
import { copy } from "./accessors";
import type { ItemDef } from "../systems/effects";

const ITEMS: ItemDef[] = [
  {
    id: "lucky-rabbits-foot",
    name: copy("item.lucky-rabbits-foot.name"),
    tier: "common",
    mods: [{ kind: "flat", stat: "luck", amount: 0.05 }],
    scalesWith: ["luck"],
  },
  {
    id: "piggy-bank",
    name: copy("item.piggy-bank.name"),
    tier: "common",
    mods: [{ kind: "flat", stat: "creditScore", amount: 0.05 }],
    scalesWith: ["creditScore"],
  },
  {
    id: "adrenal-gland",
    name: copy("item.adrenal-gland.name"),
    tier: "common",
    mods: [{ kind: "percent", stat: "attackSpeed", amount: 0.08 }],
    scalesWith: ["attackSpeed"],
  },
  {
    id: "slick-treads",
    name: copy("item.slick-treads.name"),
    brand: "grease-monkey",
    tier: "common",
    mods: [{ kind: "flat", stat: "evasion", amount: 0.03 }],
    scalesWith: ["evasion"],
  },
  {
    id: "nitro-boost",
    name: copy("item.nitro-boost.name"),
    brand: "grease-monkey",
    tier: "common",
    mods: [{ kind: "flat", stat: "playerSpeed", amount: 20 }],
    scalesWith: ["playerSpeed"],
  },
  {
    id: "bruise-cream",
    name: copy("item.bruise-cream.name"),
    brand: "masochist",
    tier: "common",
    mods: [{ kind: "flat", stat: "lifesteal", amount: 0.02 }],
    scalesWith: ["lifesteal"],
  },
  {
    id: "pain-tolerance",
    name: copy("item.pain-tolerance.name"),
    brand: "masochist",
    tier: "common",
    mods: [{ kind: "flat", stat: "maxHp", amount: 15 }],
    scalesWith: ["maxHp"],
  },
  {
    id: "steel-plating",
    name: copy("item.steel-plating.name"),
    tier: "uncommon",
    mods: [{ kind: "flat", stat: "armor", amount: 10 }],
    scalesWith: ["armor"],
  },
  {
    id: "magnet-coil",
    name: copy("item.magnet-coil.name"),
    tier: "uncommon",
    mods: [{ kind: "flat", stat: "magnetRadius", amount: 25 }],
    scalesWith: ["magnetRadius"],
  },
  {
    id: "greased-bearings",
    name: copy("item.greased-bearings.name"),
    brand: "grease-monkey",
    tier: "uncommon",
    mods: [
      { kind: "flat", stat: "evasion", amount: 0.04 },
      { kind: "flat", stat: "playerSpeed", amount: 15 },
    ],
    scalesWith: ["evasion", "playerSpeed"],
  },
  {
    id: "adrenaline-rush",
    name: copy("item.adrenaline-rush.name"),
    brand: "masochist",
    tier: "uncommon",
    mods: [{ kind: "percent", stat: "critDamage", amount: 0.12 }],
    scalesWith: ["critDamage"],
  },
  {
    id: "four-leaf-clover",
    name: copy("item.four-leaf-clover.name"),
    tier: "rare",
    maxStacks: 3,
    mods: [{ kind: "flat", stat: "luck", amount: 0.08 }],
    scalesWith: ["luck"],
  },
  {
    id: "full-synthetic",
    name: copy("item.full-synthetic.name"),
    brand: "grease-monkey",
    tier: "rare",
    maxStacks: 5,
    mods: [{ kind: "flat", stat: "evasion", amount: 0.05 }],
    scalesWith: ["evasion"],
  },
  {
    id: "glutton-for-punishment",
    name: copy("item.glutton-for-punishment.name"),
    brand: "masochist",
    tier: "rare",
    mods: [
      { kind: "flat", stat: "lifesteal", amount: 0.05 },
      { kind: "flat", stat: "maxHp", amount: 20 },
    ],
    scalesWith: ["lifesteal", "maxHp"],
  },
  {
    id: "golden-ticket",
    name: copy("item.golden-ticket.name"),
    tier: "epic",
    mods: [
      { kind: "flat", stat: "creditScore", amount: 0.15 },
      { kind: "flat", stat: "luck", amount: 0.15 },
    ],
    scalesWith: ["creditScore", "luck"],
  },
];

const ITEM_REGISTRY: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

/** Every item in the registry — the shop's item offer pool (economy.spec.todo.md). */
export const ALL_ITEMS: ItemDef[] = ITEMS;

/**
 * Looks up an ItemDef by id — same "id + count" indirection as `weaponById`
 * (run-structure.spec.todo.md's build persistence: CareerState.items never
 * embeds a full ItemDef snapshot that could drift from this registry).
 * Unknown ids return undefined rather than crashing — the caller (loadout
 * resolution) drops an item it can't resolve instead of guessing.
 */
export function itemById(id: string): ItemDef | undefined {
  return ITEM_REGISTRY[id];
}
