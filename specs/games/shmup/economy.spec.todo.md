# Shmup — Economy Spec

> Issue: **F9 #137**. Status: framing locked; all numbers in `tuning.spec.todo.md`.

## Three currencies, three time-horizons

| Resource | Horizon | Nature |
|---|---|---|
| **EXP → Levels** | permanent | earned automatically; the build skeleton |
| **Gold → Shop** | permanent, bankable | earns interest; deliberate power |
| **Hype → Ratings** | ephemeral → career | performance; see `hype-and-ratings.spec.md` |

## EXP & Levels

- **EXP is gained directly on kill** (no collection) → progression guaranteed.
- **Level-ups batch at the inter-level break — zero mid-level interruption.** Each offers **4 MAIN stats only** (`stats.spec.md`) with reroll. Exotic stats never appear here.
- 16 main stats, 4 shown → "hate all 4" is rare (~1–4%); reroll covers it.

## Gold (skill-gated)

- Gold is **physical**: enemies explode into **coins you must catch** (**Magnet Radius** widens the catch). At high Hype the crowd **tips** — extra coins thrown onto the field.
- Loop: skill → Hype → tips → more gold, but more chaos to collect → demands more skill.

## Shop

- Freeform Bullet-Heaven stock: **weapons** (fill 6 slots) + **passive items**. No generators / front-rear split.
- **Two cadences (both):** baseline shop every inter-level break + dedicated **shop nodes** on the map with bigger/rarer/unique stock.
- Offers use the weighting math in `items-and-brands.spec.todo.md` (Luck × Ratings × brand affinity).

## Gold sinks (all compete with saving for interest)

1. **Buy** rolled weapons/items.
2. **Upgrade** owned weapons (deterministic, click-to-upgrade):
   `cost(tier) = costBase × costGrowth^tier × (1 − brandDiscount)`, `brandDiscount = min(0.40, d × brandCount)`.
3. **Reroll** offers — **increasing gold** per reroll; high **Ratings** comps a few free rerolls. Hype is never spent.

## Interest (greed tension)

- Unspent gold earns interest each inter-level shop, scaled by **Credit Score** (which also boosts gold gain).
- Cap field exists but is set **absurdly high (effectively off)** for now — tunable in `tuning.spec.todo.md`.
- Tension: hoarding to compound = lingering & safe = escalation climbs + Hype decays. Greed has teeth.
