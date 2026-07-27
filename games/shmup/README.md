# SHMUP — Noahsoft sky-mercenary shmup

A separate **Phaser 3 + TypeScript** game that lives inside the Toy Box repo as its
own package and is launched from the NS-TOS terminal as `SHMUP.EXE` (the way
`HELL.EXE` opens `/hell`). Doors 97 stays vanilla-canvas and minimal-dependency;
**Phaser lives only in this package**, never the root `package.json`.

## Design docs

The full design lives in [`specs/games/shmup/`](../../specs/games/shmup/) — mirroring
the source tree, with `.spec.todo.md` meaning "designed, not yet implemented" (it
becomes `.spec.md` once a system ships). One focused `{system}.spec.todo.md` per
major system. Start with
[`overview.spec.todo.md`](../../specs/games/shmup/overview.spec.todo.md) (it indexes
the rest and maps each spec to its GitHub issue). Numeric balance values live in
[`tuning.spec.todo.md`](../../specs/games/shmup/tuning.spec.todo.md).

## Layout

```
games/shmup/         (design specs live at repo-root specs/games/shmup/*.spec.todo.md)
  index.html         Vite entry
  src/
    main.ts          Phaser game config
    scenes/          BootScene, MapScene (Season node-map), PlayScene (F6 loop), ResolveScene (episode->map cash-in)
    content/         copy registry ("copy is an asset")
    tuning/          numeric levers ("tuning is an asset")
    systems/         stat/effect/chassis/economy engines land here (F3/F4/F10/F9…)
    sprites/         sprite registry — placeholder primitives + manifest.json (F5)
    assets/sprites/  bundled sprite art, wired by path from sprites/manifest.json (F5)
    save/            SaveStore — swappable save/settings persistence (S1)
    systems/encounters/  loads /shmup-editor content and plays it (authored-encounters.spec.md)
```

## Authored content

Tiles, Units and Encounters built in `/shmup-editor` load straight into the
game — no export step. The editor persists into the Doors 97 virtual
filesystem; this bundle reads the same same-origin `ns97_fs_v1` blob back
(`src/systems/encounters/authoredContent.ts`) and plays it with the real
ship, weapons, Hype and economy around it, scrolling past the player like
any level.

**Playtests launch from the editor**, not from a menu in here: the
Encounter editor's ▶ plays one Encounter, the Connection Viewer's "▶ Play
Test Level" plays a whole assembled layout. Both navigate to
`/shmup/?playtest=...`; `src/scenes/playtestRequest.ts` parses it and
`BootScene` drops straight into the episode. See
[`specs/games/shmup/authored-encounters.spec.md`](../../specs/games/shmup/authored-encounters.spec.md).

`src/systems/encounters/scrollModel.ts` is the **one module shared with the
editor** — it owns the tile size and the level scroll speed, which decide
what an authored encounter looks like when played and so can't be mirrored
without drifting. The editor imports it directly.

Two version constants must move in lockstep with the editor's stores:
`AUTHORED_TILES_VERSION` / `AUTHORED_UNITS_VERSION` mirror
`tileStore.ts` / `unitStore.ts`'s `SAVE_VERSION`. A mismatch means the game
sees no authored content at all — that is deliberate, but bump both sides
together.

## Save storage

Gameplay/menu code depends only on the `SaveStore` interface exported from
`src/save/index.ts` — never a concrete store. That one file is the
composition root: a single `SAVE_BACKEND` constant picks which implementation
backs `saveStore`.

- **Default — `DoorsFsSaveStore`:** persists into the Doors 97 virtual
  filesystem (same-origin read/write of the shared `ns97_fs_v1` localStorage
  blob, mirroring `src/sprites/fsOverride.ts`'s read-only precedent). Saves
  appear as real, hackable files under `C:\Programs\Games\SHMUP\Saves\` in
  the Doors 97 file browser.
- **Fallback — `LocalSaveStore`:** plain `localStorage`, namespaced under
  `shmup:save:`, for contexts without a Doors 97 FS to write into.

See [`specs/games/shmup/save.spec.md`](../../specs/games/shmup/save.spec.md)
for the full design.

## Dev (once F1 wires the workspace)

```
npm install          # from repo root, after workspaces are enabled
npm run dev -w @toybox/shmup
```

## Status — this is scaffolding

A minimal skeleton to set later sessions up for success. **Still owned by F1 (#129):**

- [ ] Enable npm **workspaces** in the root `package.json` and install (commit the lockfile).
- [ ] **Pin** the exact latest stable Phaser 3 (the `3.80.1` here is a placeholder — verify/repin at install).
- [ ] Wire the **`SHMUP.EXE`** launch in `src/experiences/NsToS/NsToS.tsx`, mirroring the `HELL.EXE` path.
- [ ] Seed the `SHMUP.EXE` virtual-FS file in **both** `seed.ts` and `migrate()`.
- [ ] Decide the **build/serve path** Doors uses to load the bundle full-page.
- [ ] Confirm the root build still excludes `games/` (it does today: root `tsconfig.app.json` includes only `src/`).
```
