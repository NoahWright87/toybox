# Shmup — Save Storage Spec

> Issue: **S1 #171**. Implemented in `games/shmup/src/save/`. Status: current,
> shippable behavior.

## The interface

Gameplay, menu, and settings code depend only on the `SaveStore` port — never
a concrete storage mechanism:

```ts
interface SaveStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
  list?(prefix: string): string[]; // save slots, hall of fame, etc.
}
```

Values are strings; callers JSON-encode/decode their own payloads. `list`
returns keys whose name starts with `prefix`, with any storage-specific
namespacing/extension stripped back off.

## One composition root

`games/shmup/src/save/index.ts` is the only place that picks a concrete
implementation. Every other module imports `saveStore` (the instance) and the
`SaveStore` type from this one file — never `DoorsFsSaveStore` or
`LocalSaveStore` directly:

```ts
const SAVE_BACKEND: "doors-fs" | "local" = "doors-fs";

export const saveStore: SaveStore =
  SAVE_BACKEND === "doors-fs" ? new DoorsFsSaveStore() : new LocalSaveStore();
```

Swapping backends (e.g. for a future IndexedDB-backed store) means writing a
new `SaveStore` implementation and changing this one constant.

## Default: `DoorsFsSaveStore` — Doors 97 virtual filesystem

SHMUP is a separately-built Vite bundle served full-page at `/shmup/`, not
embedded in the Doors 97 React app, so it can't import the live `fsStore`
singleton without pulling the whole Doors app (React, full desktop seed data)
into this package's bundle. Instead `DoorsFsSaveStore` is a same-origin
reader/writer of the shared `ns97_fs_v1` localStorage blob both apps read —
the same precedent as `src/sprites/fsOverride.ts` (content-and-assets spec),
but read-write instead of read-only.

- Keys map to DOS-flavored filenames: `key.toUpperCase() + ".DAT"` (matches
  `SCORES.DAT`/`SAVE.DAT` elsewhere in the FS).
- Files live under `C:\Programs\Games\SHMUP\Saves\`, seeded under the stable
  id `SHMUP_SAVES_ID` (`fs:shmup-saves`) in the main app's `seed.ts` and
  `migrate()` — both fresh installs and existing sessions get the folder.
- Writes are idempotent against an already-Doors-seeded tree: if `/shmup/` is
  hit before Doors 97 has ever loaded on that origin, `write()` bootstraps
  the same `ROOT → Programs → Games → SHMUP → Saves` chain of stable ids
  Doors itself uses, so a later Doors load recognizes and merges with it
  instead of creating a duplicate.
- A second write to an existing key updates that file's `content` in place —
  no duplicate file is created.
- Because saves are real `FSFile` nodes, they're visible and hackable in the
  Doors 97 file browser and Notebook, same as `SCORES.DAT` elsewhere in the
  FS (root `CLAUDE.md` — "NS Doors 97 is hackable").

## Fallback: `LocalSaveStore` — plain localStorage

The standalone fallback for contexts without a Doors 97 FS to write into.
Keys are namespaced under `shmup:save:` in `localStorage` directly. Every
method is a no-op (not a throw) when `window`/`localStorage` is unavailable,
and write/remove swallow quota-exceeded errors — mirrors
`StorageAdapter.ts`'s `LocalStorageAdapter` in the main app.

## Verification

- Unit tests: `doorsFsSaveStore.test.ts` (pure `Map`-based logic — folder
  bootstrap, idempotency, write/read/remove/list, JSON round-trip simulating
  a real localStorage reload) and `localSaveStore.test.ts` (round-trip
  against an in-memory `Storage` shim, namespacing, no-window no-op).
- Manual end-to-end: load Doors 97 (seeds the FS) → load the deployed
  `/shmup/` build → `saveStore.write()` → reload `/shmup/` → `saveStore.read()`
  returns the same value → back in Doors 97, the same `ns97_fs_v1` blob shows
  a `*.DAT` file node parented under `fs:shmup-saves`.

## Related

- [`overview.spec.todo.md`](./overview.spec.todo.md)
- [`content-and-assets.spec.md`](./content-and-assets.spec.md) — the
  `fsOverride.ts` read-only precedent this design extends to read-write
- `src/experiences/NsDoors97/filesystem/` — `seed.ts`, `FileSystemStore.ts`
  (`migrate()`), `types.ts` (`SHMUP_SAVES_ID`) in the main app
