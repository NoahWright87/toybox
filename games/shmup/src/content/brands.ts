/**
 * Sponsor brands (specs/items-and-brands.spec.todo.md) — names, taglines,
 * and personalities. A brand's personality should read as a build
 * archetype (Grease Monkey Oil → dodge/speed) so players can recognize a
 * brand's identity from its decal alone, before reading a single tooltip.
 *
 * Keyed by a short brand id; weapons/items reference brands by this id
 * elsewhere (not here — this file only owns the copy).
 */
export interface SponsorBrand {
  name: string;
  tagline: string;
  personality: string;
}

export const BRANDS = {
  "grease-monkey": {
    name: "Grease Monkey Oil",
    tagline: "Slicker than the competition.",
    personality: "Dodge & speed — rewards an evasion-leaning build.",
  },
  masochist: {
    name: "Masochist Energy Drink",
    tagline: "Pain is just progress with a kick.",
    personality: "Hype-on-damage — thrives on taking hits, not avoiding them.",
  },
} as const satisfies Record<string, SponsorBrand>;

export type BrandId = keyof typeof BRANDS;

/** Look up a brand by id; never throws on an unknown id. */
export function brand(id: BrandId | string): SponsorBrand {
  return (
    (BRANDS as Record<string, SponsorBrand>)[id] ?? {
      name: `[missing brand: ${id}]`,
      tagline: "",
      personality: "",
    }
  );
}
