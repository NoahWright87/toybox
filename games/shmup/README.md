# SHMUP — Noahsoft sky-mercenary shmup

A separate **Phaser 3 + TypeScript** game that lives inside the Toy Box repo as its
own package and is launched from the NS-TOS terminal as `SHMUP.EXE` (the way
`HELL.EXE` opens `/hell`). Doors 97 stays vanilla-canvas and minimal-dependency;
**Phaser lives only in this package**, never the root `package.json`.

## Design docs

The full design lives in [`specs/`](./specs/) — one focused `{system}.spec.md` per
major system. Start with [`specs/overview.spec.md`](./specs/overview.spec.md) (it
indexes the rest and maps each spec to its GitHub issue). Numeric balance values
live in [`specs/tuning.spec.md`](./specs/tuning.spec.md).

## Layout

```
games/shmup/
  specs/             design specs (source of truth)
  index.html         Vite entry
  src/
    main.ts          Phaser game config
    scenes/          BootScene (placeholder) — game scenes land here
    content/         copy registry ("copy is an asset")
    tuning/          numeric levers ("tuning is an asset")
    systems/         stat/effect/economy engines land here (F3/F4/F9…)
    assets/sprites/  placeholder-first sprite registry (F5)
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
