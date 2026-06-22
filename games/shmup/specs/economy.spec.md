# Shmup — Economy Spec

> Issue: **F9 #137**. Status: framing locked; numbers TBD.

## Three currencies, three time-horizons

| Resource | Horizon | Nature |
|---|---|---|
| **EXP → Levels** | permanent | earned automatically; the build skeleton |
| **Gold → Shop** | permanent, bankable | earns interest; deliberate power |
| **Hype → Ratings** | ephemeral → career | performance; see `hype-and-ratings.spec.md` |

## EXP & Levels

- **EXP is gained directly on kill** (no collection) → progression is guaranteed.
- **Level-ups batch at the inter-level break — zero mid-level interruption.** Gained 3 levels in a stage → resolve 3 picks at the break. Levels are short to keep the loop tight.
- Each level-up offers **4 MAIN stats only** (`stats.spec.md`) with reroll. Exotic stats never appear here.
- With 16 main stats and 4 shown, the odds a player hates all 4 are low (≈1–4% even with a harsh "half are dead" assumption); reroll covers the rest.

## Gold (skill-gated)

- Gold is **physical**: enemies explode into **coins you must catch** (**Magnet Radius** widens the catch). At high Hype the crowd **tips** — throws extra coins onto the field.
- Loop: skill → Hype → tips → more gold, but more chaos to collect through → demands more skill.

## Shop

- Freeform Bullet-Heaven stock: **weapons** (fill the 6 slots) + **passive items**. No generators / front-rear split.
- **Two cadences (both):** a small **baseline shop every inter-level break** (Brotato cadence) + dedicated **shop nodes** on the map with bigger/rarer/unique stock.
- Item tier gated by **Ratings / sponsor tier**; weapon upgrades use exponential cost tiers.
- Offer weighting = **Luck (rarity) × Ratings (tier) × brand affinity (identity)** (`items-and-brands.spec.md`).

## Rerolls

- Cost **increasing gold** per reroll within a shop visit.
- High **Ratings** tier **comps a few free rerolls** per shop. Hype is never spent as currency.

## Interest (natural greed tension)

- Unspent gold earns interest each inter-level shop, scaled by the **Credit Score** stat (which also boosts gold gain).
- A cap field exists but is set **absurdly high (effectively off)** for now — tunable later without a refactor.
- Tension: hoarding to compound = lingering & playing safe = escalation climbs + Hype decays. Greed has teeth.
