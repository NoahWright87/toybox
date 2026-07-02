# Shmup — Overview Spec

> **Status:** Framing pass locked (2026-06-22). Structure and formulas are settled; bare numeric constants live in `tuning.spec.todo.md` and are the balance pass's job.
>
> Working name: **SHMUP**. Tracking issues: Epic 1 #126 (foundation), Epic 2 #127 (content), Epic 3 #128 (theming).

## What it is

A Noahsoft sky-mercenary **bullet-heaven shmup**, framed in-universe as a remastered "Doors 97 classic" that never existed. Setting: a dystopian **2013** as imagined from the 90s — megacorps, corporate-sponsored mercenary combat, the whole thing **televised** (Running Man / Smash TV / Tyrian tone). `Noahsoft presents:` card and a "Works on Doors 97!" sticker are subtle cross-promotion back to the catalog.

**Tone:** zany but reverent — a genuinely good shmup wearing a goofy 90s game-show skin.

## The central pillar: grazing = the show

The crowd cheers because you *almost died and didn't*. Grazing and showy play feed a **Hype** meter; sustained Hype converts to **Ratings** (career standing). The FTL-style "encroaching danger" is fiction-motivated: the **airtime clock** and rising season difficulty force you to keep performing.

## Cross-cutting principles (every system obeys these)

1. **One shared stat pool.** All systems compose modifiers onto the same stats via one grammar (`stats.spec.md`).
2. **Freeform modifier stacking, not authored combos.** Synergies emerge from the math (Nova Drift / RoR2).
3. **Data-driven core.** New content is data, not new code.
4. **Copy is an asset.** All human-authored text lives in a content registry Noah edits (`content-and-assets.spec.todo.md`).
5. **Tuning is an asset.** All numeric levers live in one typed tuning module (`tuning.spec.todo.md`) — the balance pass and Noah adjust there, never in systems code.
6. **Placeholder-first art.** Everything renders as colored primitives via a sprite registry; real art is a data swap.

## Tech & placement

- **Monorepo / npm workspaces.** Doors 97 stays vanilla & minimal-dep. The shmup is its own workspace package (`games/shmup/`) using **Phaser 3 (pinned exact)**; Phaser never enters the root `package.json`.
- **Launch like `HELL.EXE`:** `SHMUP.EXE` in the virtual FS loads the separately-built bundle full-page from NS-TOS.
- **Web only for now**, logic kept shell-agnostic where cheap.

## Career structure (summary)

A **career** = ~5 **Seasons**, each a node map ending in a **Season Finale boss**; the last ends in the **Series Finale** → optional endless **Syndication**. One ship across the whole career. **One death ends the episode** (no hull lives), costing Ratings; **Ratings < 0 = Cancelled = career over.** See `run-structure.spec.todo.md`.

## Spec map

| Spec | Covers | Issues |
|---|---|---|
| `stats.spec.md` | composition grammar, archetypes, 16 main stats — **implemented** | F3 #131 |
| `combat.spec.todo.md` | damage, defense pipeline, mobility | F3 #131, F6 #134 |
| `weapons.spec.todo.md` | effect engine, attack modifiers, gold upgrades | F4 #132, C1 #140, C2 #141 |
| `items-and-brands.spec.todo.md` | items, stacking, brand tags, offer weighting (offer-weighting math **implemented** by F9; item/brand catalog growth still open) | F4 #132, F9 #137, C3 #142, C4 #143 |
| `chassis.spec.md` | chassis framework, default chassis, Focus mode — **implemented** | F10 #138 |
| `chassis.spec.todo.md` | Epic 2 chassis content (Ikaruga polarity, more chassis), chassis selection | C7 #146, C8 #147 |
| `hype-and-ratings.spec.md` | grazing, Hype + Ratings formulas (Model 1) — **implemented** | F7 #135 |
| `economy.spec.md` | currencies, level-ups (end-of-level break only), coins/tips, interest, shop, gold sinks, offer weighting — **implemented** | F9 #137 |
| `economy.spec.todo.md` | remaining balance pass + content growth | F9 #137 |
| `run-structure.spec.md` | seasons, node map, difficulty escalation, episode flow, career persistence — **implemented** | F8 #136 |
| `run-structure.spec.todo.md` | remaining death/audience polish, radar item | F11 #139 |
| `audience-and-score.spec.todo.md` | studio audience, crowd comments, score & results | T10 #161, C14 #163 |
| `content-and-assets.spec.md` | sprite registry, asset pipeline — **implemented** | F5 #133 |
| `content-and-assets.spec.todo.md` | copy registry | F2 #130 |
| `save.spec.md` | swappable SaveStore, Doors-FS-backed default — **implemented** | S1 #171 |
| `tuning.spec.todo.md` | the single home of every numeric lever | (all) |
