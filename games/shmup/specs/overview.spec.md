# Shmup — Overview Spec

> **Status:** Framing pass locked (2026-06-22). Structure and formulas are settled; bare numeric constants (the `K`s, decay rates, curves) are deliberately left to the balance pass.
>
> Working name: **SHMUP**. Tracking issues: Epic 1 #126 (foundation), Epic 2 #127 (content), Epic 3 #128 (theming).

## What it is

A Noahsoft sky-mercenary **bullet-heaven shmup**, framed in-universe as a remastered "Doors 97 classic" that never existed. Setting: a dystopian **2013** as imagined from the 90s — megacorps, corporate-sponsored mercenary combat, the whole thing **televised** (Running Man / Smash TV / Tyrian tone). `Noahsoft presents:` intro card and a "Works on Doors 97!" sticker are subtle cross-promotion back to the rest of the catalog.

**Tone:** zany but reverent — a genuinely good shmup wearing a goofy 90s game-show skin.

## The central pillar: grazing = the show

The crowd cheers because you *almost died and didn't*. Grazing and showy play feed a **Hype** meter; sustained Hype converts to **Ratings** (your career standing). This turns the FTL-style "encroaching danger" into fiction-motivated pressure: the **airtime clock** and the season's rising difficulty force you to keep performing.

## Cross-cutting principles (every system obeys these)

1. **One shared stat pool.** Weapons, items, chassis, economy, and Hype all compose modifiers onto the same stats via one grammar (see `stats.spec.md`).
2. **Freeform modifier stacking, not authored combos.** Synergies emerge from the math (Nova Drift / RoR2 model).
3. **Data-driven core.** Stats/weapons/items/modifiers are data through a generic effect engine — new content is data, not new code.
4. **Copy is an asset.** All human-authored text lives in a content registry Noah edits (`content-and-assets.spec.md`).
5. **Placeholder-first art.** Everything renders as colored primitives via a sprite registry from day one; real art is a data swap.

## Tech & placement

- **Monorepo / npm workspaces.** Doors 97 stays the existing vanilla-canvas, minimal-dependency app. The shmup is its **own workspace package** (`games/shmup/`) using **Phaser 3 (pinned exact)**. Phaser never enters the root `package.json`.
- **Launch like `HELL.EXE`:** a `SHMUP.EXE` file in the virtual FS; typing it in NS-TOS loads the separately-built shmup bundle full-page.
- **Web only for now**, gameplay logic kept shell-agnostic where cheap (later Steam/mobile wrapper without a rewrite).

## Career structure (one-paragraph summary)

A **career** = ~5 **Seasons**, each a node map ending in a **Season Finale boss**; the last Season ends in the **Series Finale (final boss)** → optional endless **Syndication**. You build one ship across the whole career. **One death ends the episode** (no hull lives), costing Ratings; **Ratings < 0 = Cancelled = career over**. Details in `run-structure.spec.md`.

## Spec map

| Spec | Covers | Issues |
|---|---|---|
| `stats.spec.md` | composition grammar, archetypes, 16 main stats, StatDef | F3 #131 |
| `combat.spec.md` | damage, defense pipeline, mobility | F3 #131, F6 #134 |
| `weapons.spec.md` | effect-composition engine, weapons, attack modifiers | F4 #132, C1 #140, C2 #141 |
| `items-and-brands.spec.md` | passive items, brand tagging, offer weighting | F4 #132, F9 #137, C3 #142, C4 #143 |
| `chassis.spec.md` | chassis framework, focus, polarity example | F10 #138, C7 #146, C8 #147 |
| `hype-and-ratings.spec.md` | grazing, Hype + Ratings formulas (Model 1) | F7 #135 |
| `economy.spec.md` | currencies, coins/tips, interest, shop, level-ups | F9 #137 |
| `run-structure.spec.md` | seasons, node map, death, persistence, escalation | F8 #136, F11 #139 |
| `audience-and-score.spec.md` | studio audience, crowd comments, score & results | T10 #161, C14 #163 |
| `content-and-assets.spec.md` | copy registry, sprite registry, asset pipeline | F2 #130, F5 #133 |
