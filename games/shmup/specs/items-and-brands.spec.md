# Shmup — Items & Brands Spec

> Issues: **F4 #132** (engine), **C3 #142** (items), **C4 #143** (graze items), **F9 #137** (offers). Status: framing locked.

## Passive items

- Items are **modifier bundles** over the shared stat pool (`stats.spec.md`), composed through the effect engine.
- **Unlimited item slots** — no cap (genre convention; do not second-guess).
- Each item declares `scalesWith` for the explicit-stat display.

## Conditional / "while grazing" items

Some items key off **transient state** (the second modifier layer): "+damage while grazing", "shields recharge while grazing", etc. They subscribe to the graze/Hype event API (`hype-and-ratings.spec.md`) and apply only while the condition holds. These reinforce the showmanship theme mechanically.

## Brand tagging (the synergy-discovery engine)

Items carry **brand tags**. This replaces authored combos with emergent build identity:

- **Owning a brand's items weights future offers toward that brand** (sponsors back their winners) — the Brotato tag-weighting / Borderlands-manufacturer model.
- Brands have **personalities = build archetypes** (e.g. *Grease Monkey Oil* → dodge/speed; a Masochist brand → Hype-on-damage). Names/personalities live in the content registry; sponsor decals are the visible badge (`audience-and-score.spec.md`, sponsor issue C10 #149).

## Three orthogonal RNG dials (offer weighting)

When generating level-up and shop offers:

| Dial | Controls | Source |
|---|---|---|
| **Luck** | rarity weighting | stat |
| **Ratings / sponsor tier** | which *tier* of items is available at all | career meter |
| **Brand affinity** | *identity* steering toward owned brands | items held |

None are redundant: Hype/Ratings raises the ceiling, Luck biases the roll under it, brand affinity steers identity.
