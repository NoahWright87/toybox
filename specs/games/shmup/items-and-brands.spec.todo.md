# Shmup — Items & Brands Spec

> Issues: **F4 #132** (engine), **C3 #142** (items), **C4 #143** (graze items), **F9 #137** (offers). Status: framing locked. Numbers live in `tuning.spec.todo.md`.

## Passive items

- Items are **modifier bundles** over the shared stat pool (`stats.spec.md`), composed through the effect engine.
- **Unlimited item slots.** Items **stack** — owning two sums their modifiers through the grammar. No upgrade mechanic.
- Some items carry a **`maxStacks` cap** (the ones that'd break uncapped, e.g. % evasion). At cap, the offer system stops offering that item.
- Each item declares `scalesWith` for the explicit-stat display.

## Conditional / "while grazing" items

Some items key off **transient state** (the second modifier layer): "+damage while grazing", "shields recharge while grazing", etc. They subscribe to the graze/Hype event API (`hype-and-ratings.spec.md`) and apply only while the condition holds.

## Brand tagging (the synergy-discovery engine)

Items/weapons carry **brand tags**, replacing authored combos with emergent identity:
- **Owning a brand's items weights future offers toward that brand** (sponsors back their winners).
- Brands have **personalities = build archetypes** (*Grease Monkey Oil* → dodge/speed; a Masochist brand → Hype-on-damage). Names/personalities in the content registry; sponsor decals are the visible badge.
- Brand affinity = **count of distinct brand items owned** (not upgrade tiers); feeds offer weighting and the weapon-upgrade discount.

## Offer-weighting math (level-up & shop offers)

The whole thing is a **weighted random draw** (`P(x) = weight_x / Σ weights`). Three orthogonal dials bend the weights at three stages:

```
# Stage 1 — Ratings/sponsor sets available tiers
maxTier = sponsorTier(Ratings)            # Epics locked until famous enough
minTier rises mildly at high Ratings      # junk Commons drop out

# Stage 2 — roll a tier; rarity skews upward (geometric)
rarityLuck = Luck + luckFromD × Difficulty            # Difficulty gives a slight Luck-like boost
w_tier  = baseWeight_tier × (1 + rarityLuck) ^ tierRank   # Common rank 0, Uncommon 1, ...
P(tier) = w_tier / Σ w_tier

# Stage 3 — pick an item in that tier; brand affinity steers
affinity_i = min(5, 1 + k_brand × ownedCount(brand_i))
w_item     = baseItemWeight_i × affinity_i
P(item)    = w_item / Σ w_item

# draw N slots WITHOUT replacement; reroll re-runs the whole draw at increasing gold cost
```

| Dial | Stage | Controls |
|---|---|---|
| **Ratings / sponsor** | 1 | which *tier* is available (ceiling + soft floor) |
| **Luck (+ Difficulty)** | 2 | rarity skew of the tier roll; D adds a creeping rarity floor as you go deeper |
| **Brand affinity** | 3 | *identity* steering within the tier |

None redundant: Ratings raises the ceiling, Luck/Difficulty bias the roll under it, brand affinity steers identity.
