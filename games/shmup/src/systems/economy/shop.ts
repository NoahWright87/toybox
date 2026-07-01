/**
 * Shop stock (economy.spec.todo.md): freeform Bullet-Heaven stock — weapons
 * (fill the 6 slots) + passive items, no generators/front-rear split. Both
 * cadences (the small baseline shop every break, and dedicated map shop
 * nodes with bigger/rarer stock) draw from the same pool through the same
 * offer-weighting engine (`./offers.ts`) — only slot count/context differ.
 */
import { MAX_WEAPON_SLOTS } from "../effects";
import type { ItemDef, OwnedItem, OwnedWeapon, WeaponDef } from "../effects";
import { generateOffers } from "./offers";
import type { OfferCandidate, OfferContext } from "./offers";
import type { RarityId } from "./rarity";

export type ShopStockKind = "weapon" | "item";

export interface ShopStockEntry {
  kind: ShopStockKind;
  id: string;
  weapon?: WeaponDef;
  item?: ItemDef;
}

function tierOf(tier: RarityId | undefined): RarityId {
  return tier ?? "common";
}

/**
 * Brand affinity counts (items-and-brands.spec.todo.md): "count of distinct
 * brand items owned (not upgrade tiers)". Each owned weapon slot counts once
 * regardless of its upgrade tier; each owned item stack counts its full
 * count (more copies of a brand's item = stronger identity signal).
 */
export function ownedBrandCounts(weapons: readonly OwnedWeapon[], items: readonly OwnedItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { weapon } of weapons) {
    if (weapon.brand) counts[weapon.brand] = (counts[weapon.brand] ?? 0) + 1;
  }
  for (const { item, count } of items) {
    if (item.brand) counts[item.brand] = (counts[item.brand] ?? 0) + count;
  }
  return counts;
}

/** An item at its maxStacks cap stops being offered (items-and-brands.spec.todo.md). */
function itemAtCap(item: ItemDef, ownedItems: readonly OwnedItem[]): boolean {
  if (item.maxStacks === undefined) return false;
  const owned = ownedItems.find((o) => o.item.id === item.id);
  return (owned?.count ?? 0) >= item.maxStacks;
}

export interface ShopStockInput {
  weaponPool: readonly WeaponDef[];
  itemPool: readonly ItemDef[];
  ownedWeapons: readonly OwnedWeapon[];
  ownedItems: readonly OwnedItem[];
  slotCount: number;
  ctx: OfferContext;
  rng?: () => number;
}

/** Generates one shop visit's stock — weapon slots are omitted entirely once all 6 chassis slots are full. */
export function generateShopStock(input: ShopStockInput): ShopStockEntry[] {
  const weaponSlotsFull = input.ownedWeapons.length >= MAX_WEAPON_SLOTS;
  const entryById = new Map<string, ShopStockEntry>();
  const candidates: OfferCandidate[] = [];

  if (!weaponSlotsFull) {
    for (const weapon of input.weaponPool) {
      const id = `weapon:${weapon.id}`;
      entryById.set(id, { kind: "weapon", id: weapon.id, weapon });
      candidates.push({ id, tier: tierOf(weapon.tier), brand: weapon.brand });
    }
  }
  for (const item of input.itemPool) {
    if (itemAtCap(item, input.ownedItems)) continue;
    const id = `item:${item.id}`;
    entryById.set(id, { kind: "item", id: item.id, item });
    candidates.push({ id, tier: tierOf(item.tier), brand: item.brand });
  }

  const drawn = generateOffers(candidates, input.slotCount, input.ctx, input.rng);
  return drawn.map((c) => entryById.get(c.id)!);
}
