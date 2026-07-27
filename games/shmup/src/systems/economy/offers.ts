/**
 * Offer-weighting engine (items-and-brands.spec.todo.md): three orthogonal
 * RNG dials bend a weighted random draw —
 *   Stage 1 (Ratings/sponsor): sets the available tier range (ceiling+floor).
 *   Stage 2 (Luck + Difficulty via rarityLuck): skews which tier gets rolled.
 *   Stage 3 (brand affinity): steers which item within that tier gets picked.
 * Pure math, content-agnostic beyond the `OfferCandidate` shape — weapons
 * and items both flow through this the same way (see `./shop.ts`).
 */
import { TUNING } from "../../tuning";
import type { BrandId } from "../../content/brands";
import { rarityLuck } from "../difficulty";
import { RARITY_IDS, rarityRank } from "./rarity";
import type { RarityId } from "./rarity";

export interface OfferCandidate {
  id: string;
  tier: RarityId;
  brand?: BrandId;
  /** Base item weight within its tier (Stage 3's w_item); defaults to 1 (uniform) when omitted. */
  weight?: number;
}

export interface OfferContext {
  /** The player's current Luck stat value (raw additive fraction, base 0). */
  luck: number;
  /** Current Difficulty scalar — D adds a creeping rarity floor as you go deeper (rarityLuck). */
  D: number;
  /** Ratings tier rank (0 = Nobody .. 7 = Kevin Bacon) — gates the tier ceiling/floor. */
  ratingsRank: number;
  /** Distinct-brand-items-owned counts, keyed by BrandId — Stage 3's ownedCount(brand). */
  ownedBrandCounts: Readonly<Record<string, number>>;
}

/** Stage 1: Ratings/sponsor sets the tier ceiling (+ a mildly rising floor at high Ratings). */
export function tierRankRange(ratingsRank: number): { min: number; max: number } {
  const { maxTierRankByRatingsRank, minTierRankByRatingsRank } = TUNING.offers;
  const idx = Math.min(maxTierRankByRatingsRank.length - 1, Math.max(0, Math.floor(ratingsRank)));
  return { min: minTierRankByRatingsRank[idx], max: maxTierRankByRatingsRank[idx] };
}

/** Stage 2: weighted tier roll — w_tier = baseWeight_tier * (1 + rarityLuck)^tierRank, restricted to the Stage-1 range. */
export function rollTier(rarityLuckValue: number, ratingsRank: number, rng: () => number = Math.random): RarityId {
  const { min, max } = tierRankRange(ratingsRank);
  // Guard against a pathological rarityLuck <= -1, which would zero/negate the exponent base.
  const base = Math.max(0.01, 1 + rarityLuckValue);

  const weights: number[] = [];
  for (let rank = min; rank <= max; rank++) {
    weights.push(TUNING.offers.tierBaseWeight[rank] * Math.pow(base, rank));
  }
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return RARITY_IDS[min + i];
  }
  return RARITY_IDS[max];
}

/** Stage 3: affinity_i = min(brandAffinityCap, 1 + kBrand * ownedCount(brand_i)) — unbranded candidates get affinity 1 (no steering). */
export function brandAffinity(ownedCount: number): number {
  return Math.min(TUNING.offers.brandAffinityCap, 1 + TUNING.offers.kBrand * Math.max(0, ownedCount));
}

/** Picks one candidate from `tier`, weighted by base item weight x brand affinity. Undefined if that tier has no stock. */
export function pickItemInTier(
  candidates: readonly OfferCandidate[],
  tier: RarityId,
  ownedBrandCounts: Readonly<Record<string, number>>,
  rng: () => number = Math.random
): OfferCandidate | undefined {
  const pool = candidates.filter((c) => c.tier === tier);
  if (pool.length === 0) return undefined;

  const weights = pool.map((c) => (c.weight ?? 1) * brandAffinity(c.brand ? (ownedBrandCounts[c.brand] ?? 0) : 0));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * Draws `count` distinct offers without replacement. Each slot re-rolls a
 * tier (Stage 2) then an item within it (Stage 3); if the rolled tier has no
 * stock left, falls back to the nearest tier (by rank distance) that does,
 * so a dry tier never silently shrinks the result below `count` while any
 * candidate remains. Reroll (economy.spec.todo.md) is just calling this
 * again with a fresh `rng` draw — there's no separate "reroll" math here.
 */
export function generateOffers(
  candidates: readonly OfferCandidate[],
  count: number,
  ctx: OfferContext,
  rng: () => number = Math.random
): OfferCandidate[] {
  const remaining = [...candidates];
  const picked: OfferCandidate[] = [];
  const rarityLuckValue = rarityLuck(ctx.luck, ctx.D);

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const rolledTier = rollTier(rarityLuckValue, ctx.ratingsRank, rng);
    let choice = pickItemInTier(remaining, rolledTier, ctx.ownedBrandCounts, rng);

    if (!choice) {
      const tiersByDistance = [...RARITY_IDS].sort(
        (a, b) => Math.abs(rarityRank(a) - rarityRank(rolledTier)) - Math.abs(rarityRank(b) - rarityRank(rolledTier))
      );
      for (const fallbackTier of tiersByDistance) {
        choice = pickItemInTier(remaining, fallbackTier, ctx.ownedBrandCounts, rng);
        if (choice) break;
      }
    }

    if (!choice) break;
    picked.push(choice);
    remaining.splice(remaining.indexOf(choice), 1);
  }

  return picked;
}
