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
    scenes/          BootScene (placeholder) — game scenes land here
    content/         copy registry ("copy is an asset")
    tuning/          numeric levers ("tuning is an asset")
    systems/         stat/effect/economy engines land here (F3/F4/F9…)
    sprites/         sprite registry — placeholder primitives + manifest.json (F5)
    assets/sprites/  bundled sprite art, wired by path from sprites/manifest.json (F5)
```

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
