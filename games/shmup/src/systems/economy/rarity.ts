/**
 * Item/weapon rarity tiers (items-and-brands.spec.todo.md's offer-weighting
 * Stage 1/2): Ratings/sponsor sets the available ceiling+floor tier, Luck
 * (+Difficulty) skews which tier actually gets rolled within that range.
 * Rank = array index (Common = 0, ascending) — order here IS the ordering,
 * same convention as content/ratings.ts's RATINGS_LADDER.
 *
 * A leaf module by design: no imports, so `systems/effects` (WeaponDef/
 * ItemDef's `tier` field) can depend on this without creating a cycle back
 * from `systems/economy` (which itself depends on `systems/effects` for
 * shop stock — see `./shop.ts`).
 */
export const RARITY_IDS = ["common", "uncommon", "rare", "epic"] as const;
export type RarityId = (typeof RARITY_IDS)[number];

export function rarityRank(id: RarityId): number {
  return RARITY_IDS.indexOf(id);
}

export function rarityAtRank(rank: number): RarityId {
  return RARITY_IDS[Math.min(RARITY_IDS.length - 1, Math.max(0, Math.round(rank)))];
}
