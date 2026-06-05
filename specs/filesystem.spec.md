# NS Doors 97 — Virtual Filesystem Architecture

## Overview

The virtual filesystem (FS) is a persistent, in-memory tree of nodes (files, folders, and shortcuts) that underpins all data storage in NS Doors 97. Every app that needs to save or read data — score files, drawings, recordings, text documents — uses the FS. No app may use raw `localStorage` keys or IndexedDB directly.

The FS is a singleton (`fsStore`) backed by `localStorage` through a swappable `StorageAdapter` interface. A React context layer (`FSProvider` / `useFS`) wraps the singleton so components re-render automatically whenever the tree changes.

## Source files

| File | Purpose |
|---|---|
| `src/experiences/NsDoors97/filesystem/types.ts` | Node type definitions, well-known IDs, icon map |
| `src/experiences/NsDoors97/filesystem/StorageAdapter.ts` | Storage abstraction (`StorageAdapter` interface + `LocalStorageAdapter`) |
| `src/experiences/NsDoors97/filesystem/FileSystemStore.ts` | Singleton class with full CRUD, persistence, migration, events |
| `src/experiences/NsDoors97/filesystem/FSContext.tsx` | `FSProvider` component + `useFS` hook |
| `src/experiences/NsDoors97/filesystem/seed.ts` | First-run tree seeding (called on new users or after `reset()`) |
| `src/experiences/NsDoors97/filesystem/index.ts` | Barrel re-export of all above |

## Node types

All tree nodes are one of three shapes, discriminated by `kind`:

```typescript
type FSNode = FSFile | FSFolder | FSShortcut;

interface FSFile {
  id: string;
  kind: "file";
  name: string;
  parentId: string;
  createdAt: number;        // Unix ms
  modifiedAt: number;
  fileType: FSFileType;     // see below
  content: string;          // UTF-8 text; binary assets store base64 or are left empty
  mimeType: string;
  system: boolean;          // true = protected from deletion/rename
  readonly: boolean;        // true = Notebook shows read-only; writeFile is still allowed internally
  appId?: string;           // ID of the app that owns/opens this file
}

interface FSFolder {
  id: string;
  kind: "folder";
  name: string;
  parentId: string | null;  // null only for the root node
  createdAt: number;
  modifiedAt: number;
  system: boolean;
}

interface FSShortcut {
  id: string;
  kind: "shortcut";
  name: string;
  parentId: string;
  createdAt: number;
  modifiedAt: number;
  system: boolean;
  targetAppId?: string;     // open this app when the shortcut is activated
  targetFilePath?: string;  // C:\-style path to resolve and open
}
```

### File types (`FSFileType`)

```
"text" | "exe" | "bat" | "sys" | "scr" | "drv"
"tmp"  | "zip" | "bmp" | "png" | "ini" | "wav" | "dat" | "lnk"
```

Each type has an emoji icon defined in `FILE_TYPE_ICONS` (used by `FilesApp` and desktop icon rendering). `getNodeIcon(node)` returns the appropriate emoji for any node.

## Well-known IDs

All stable IDs are declared as constants in `types.ts` and re-exported from the barrel.

### Folder IDs

| Constant | Value | Path | Notes |
|---|---|---|---|
| `ROOT_ID` | `"fs:root"` | `C:\` | Virtual drive root |
| `DESKTOP_ID` | `"fs:desktop"` | `C:\Desktop` | Drives desktop icon rendering |
| `DUMPSTER_ID` | `"fs:dumpster"` | `C:\Recycle Bin` | Recycle Bin; `system: true` |
| `DOCUMENTS_ID` | `"fs:documents"` | `C:\Documents` | User documents |
| `PROGRAMS_ID` | `"fs:programs"` | `C:\Programs` | App programs folder |
| `GAMES_ID` | `"fs:games"` | `C:\Programs\Games` | Game sub-folders |
| `ACC_ID` | `"fs:accessories"` | `C:\Programs\Accessories` | Accessory apps |
| `SYSTEM_ID` | `"fs:system"` | `C:\System` | OS config files (readonly) |
| `DOWNLOADS_ID` | `"fs:downloads"` | `C:\Downloads` | Easter-egg downloads |
| `EGO_ID` | `"fs:ego"` | `C:\EGO` | HELL game folder |

### Stable file IDs (app-owned)

| Constant | Value | App |
|---|---|---|
| `NS_ART_BACKUP_ID` | `"fs:nsart-backup"` | NS Art auto-save (`Untitled.nsart` in `C:\Programs\Accessories\NS Art\`) |
| `DH_SCORES_ID` | `"fs:scores-dh"` | Duck & Learn (`SCORES.DAT` in `C:\Programs\Games\Duck & Learn\`) |
| `TR_SCORES_ID` | `"fs:scores-tr"` | Typing Racer (`SCORES.DAT` in `C:\Programs\Games\Typing Racer\`) |

## Storage layer

### `StorageAdapter` interface

```typescript
interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

`LocalStorageAdapter` is the production implementation. It wraps every call in a try/catch to silently survive quota errors or private-browsing restrictions.

The `FileSystemStore` constructor accepts any `StorageAdapter`. Swapping to IndexedDB requires only a new adapter class — no other changes.

**Never** bypass the adapter with direct `localStorage` calls inside app code. Always go through `fsStore` or the adapter.

### Storage key

The entire tree is serialized as `JSON.stringify([...Map.entries()])` under the key `"ns97_fs_v1"`. The Map maps node ID strings to `FSNode` objects. Deserialization reconstructs the Map with `new Map<string, FSNode>(entries)`.

## `FileSystemStore` API

The singleton is exported as `fsStore` from `FileSystemStore.ts`.

### Queries

| Method | Returns | Notes |
|---|---|---|
| `getNode(id)` | `FSNode \| undefined` | Any node by ID |
| `getFolder(id)` | `FSFolder \| undefined` | Type-safe folder getter |
| `getFile(id)` | `FSFile \| undefined` | Type-safe file getter |
| `getShortcut(id)` | `FSShortcut \| undefined` | Type-safe shortcut getter |
| `getChildren(folderId)` | `FSNode[]` | Sorted: folders first, then alphabetical by name |
| `getPath(id)` | `string` | Returns `"C:\\"` for root; `"C:\\Folder\\file.txt"` otherwise |
| `getNodeByPath(path)` | `FSNode \| undefined` | Case-insensitive path resolution from `C:\...` |
| `findChild(folderId, name)` | `FSNode \| undefined` | Case-insensitive name search within a folder |

### Mutations

| Method | Notes |
|---|---|
| `createFile(parentId, name, options)` | `options`: `fileType`, `appId`, `content`, `mimeType`, `readonly`, `system`, `id` |
| `createFolder(parentId, name, options)` | `options`: `system`, `id`; `parentId` may be `null` for root |
| `createShortcut(parentId, name, options)` | `options`: `targetAppId`, `targetFilePath`, `system`, `id` |
| `ensureFile(parentId, name, options)` | Find-or-create: returns existing file if name matches, otherwise creates |
| `writeFile(id, content, mimeType?)` | Update file content and `modifiedAt`; triggers save + emit |
| `renameNode(id, newName)` | No-op if `node.system === true` |
| `moveNode(id, newParentId)` | Reparents the node (used internally by `deleteNode`) |
| `deleteNode(id)` | Moves to Dumpster; if already in Dumpster, permanently deletes; no-op for system nodes |
| `permanentDelete(id)` | Recursively deletes node and all descendants immediately |
| `emptyDumpster()` | Permanently deletes all direct children of the Dumpster folder |

### Batching

```typescript
fsStore.batch(() => {
  // multiple createFile / createFolder calls
});
// save() + emit() fire exactly once after the function returns
```

Use during seeding and migration to avoid a save+emit on every individual node creation. Always prefer `batch()` when creating more than one node at a time.

### Events

```typescript
const unsubscribe = fsStore.subscribe(() => {
  // re-read whatever you care about
});
// later:
unsubscribe();
```

The event system is a simple Set of listeners. `emit()` calls every listener synchronously after every mutation (or after a batch ends). `FSProvider` uses this to trigger a React re-render.

### Dev helper

`fsStore.reset()` clears the node map and re-seeds from scratch. Exposed for development; not called in production.

## React integration

### `FSProvider`

Wrap the entire NsDoors97 component tree with `FSProvider`. It subscribes to `fsStore` and forces a re-render on every FS change, making `useFS()` always return a fresh view.

```typescript
// In NsDoors97Page.tsx
<FSProvider>
  <OsDialogProvider>
    <NsDoors97 />
  </OsDialogProvider>
</FSProvider>
```

### `useFS()`

Returns the `FileSystemStore` singleton. Any call to `store.getChildren(...)` or `store.getNode(...)` inside a component that called `useFS()` will re-run on every FS mutation. Throws if called outside an `FSProvider`.

```typescript
const store = useFS();
const children = store.getChildren(DESKTOP_ID); // re-evaluated on every FS change
```

### Direct singleton access (outside FSProvider)

Apps or utilities that run outside the React tree (standalone pages, non-FS-aware child components) may import and call `fsStore` directly. This is intentional and correct — it bypasses the reactivity layer but the data is always up to date.

```typescript
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { NS_ART_BACKUP_ID } from "../NsDoors97/filesystem/types";

fsStore.writeFile(NS_ART_BACKUP_ID, json); // works anywhere; no re-render in other components
```

## Migration pattern

`FileSystemStore.migrate()` runs automatically after every `load()`. It checks for stable-ID nodes that may not exist in old serialized data (because they were added to the seed after the user's first visit) and creates them if absent.

When adding a new stable-ID node:
1. Add it to `seed.ts` (for new users).
2. Add a corresponding block to `migrate()` in `FileSystemStore.ts` (for existing users).

The migration block should:
- Check `this.nodes.has(STABLE_ID)` — skip if already present.
- Locate the parent folder by path (`this.getNodeByPath(...)`).
- Create the node with `this.nodes.set(STABLE_ID, { ... })` (no flush, no batch — `migrate()` calls `this.save()` once at the end if `changed === true`).

## Initial file tree (seed)

The `seedFileSystem()` function populates the tree for first-time users. All folder and file creation happens inside a `batch()` call so only one save+emit fires.

### Top-level structure

```
C:\
  Desktop\
    My Doors            (shortcut → app:files, system)
    Dumpster            (shortcut → app:dumpster, system)
    README.txt          (text file with HELL.EXE instructions)
  Documents\
    readme.txt          (NS Doors 97 welcome / system requirements)
    Letter to Mom.txt
    Todo.txt
    Budget 1997.txt
    Secret Diary.txt
  Programs\
    Games\
      HELL\
        HELL.EXE        (appId: "tos-only" — shows error if double-clicked)
        README.TXT      (readonly)
      Tic-Tac-Toe\      (Tic-Tac-Toe.exe, SCORES.DAT)
      Word Whirlwind\   (Word Whirlwind.exe, SCORES.DAT)
      Chain Reaction\   (Chain Reaction.exe, SCORES.DAT)
      Number Muncher\   (Number Muncher.exe, SCORES.DAT)
      Cards\            (Cards.exe)
      8-Ball Pool\      (Pool.exe)
      Duck & Learn\     (Duck & Learn.exe, SCORES.DAT [id: DH_SCORES_ID])
      Bomb Finder\      (Bomb Finder.exe)
      WORDS\            (WORDS.exe, SCORES.DAT)
      Peg Solitaire\    (Peg Solitaire.exe)
      Typing Racer\     (Typing Racer.exe, SCORES.DAT [id: TR_SCORES_ID])
      Solitaire.exe     (stub — no appId)
      Minesweeper.exe   (stub — no appId)
      SkiFree.exe       (stub — no appId)
    Accessories\
      Notebook\         (Notebook.exe)
      NS Art\           (NS Art.exe, Untitled.nsart [id: NS_ART_BACKUP_ID])
      Sound Recorder\   (Sound Recorder.exe)
      MIDI Editor\      (MIDI Editor.exe)
    Internet\
      Internet Explorer.exe  (appId: "internet")
      Netscape Navigator.exe (stub)
      WinZip.exe             (stub)
    Screensavers\
      Starfield.scr, Fireworks.scr, Bouncing Shapes.scr (appId: "screensavers")
      Flying Toasters.scr (stub)
  System\
    config.sys, autoexec.bat, win.ini, system.ini  (readonly)
    Drivers\  (mouse.drv, display.drv, sound.drv, comm.drv)
    Temp\     (~tmp0001.tmp, ~tmp0002.tmp, ~tmp0087.tmp)
  Downloads\
    netscape_40_setup.exe, clipart_pack_vol2.zip,
    cool_space_wallpaper.bmp, AUTORUN.INF
  EGO\        [id: EGO_ID]
    HELL.EXE  (appId: "tos-only")
    README.TXT, INSTALL.BAT (readonly)
    SPRITES\  (23 .BMP sprite files, all readonly)
  Recycle Bin\  [id: DUMPSTER_ID, system]
    old_draft.txt       (pre-seeded deleted letter)
    budget_old_1996.txt
    ns95_uninstall.exe
```

## App integrations

### Notebook

Reads and writes `FSFile.content` via `fsStore.writeFile(fileId, content)`. When a file is saved, fires `onFileSaved(fileId, fileName)` so `NsDoors97.tsx` can add a desktop shortcut pointing to the file's FS path.

Opening from the taskbar Start menu creates a new empty `text` file in `C:\Documents\` and opens it. Opening from `FilesApp` passes the existing file's ID.

### FilesApp (My Doors)

Drives navigation via a folder-ID stack (`useState<string[]>`). `store.getChildren(currentFolderId)` is called reactively on every render (re-renders on FS change via `useFS()`). Address bar shows `store.getPath(currentFolderId)`.

The Dumpster window (`isDumpster={true}`) reuses `FilesApp` with `startFolderId={DUMPSTER_ID}`. In Dumpster mode, clicking a non-folder item prompts for permanent deletion rather than opening it. The "Empty Dumpster" button calls `store.emptyDumpster()`.

### NS Art

Saves to `NS_ART_BACKUP_ID` via `fsStore.writeFile(NS_ART_BACKUP_ID, json)`. On load, reads from that file; if empty, checks the old localStorage key for legacy migration, then falls back to blank canvas.

NS Art may be opened standalone (outside the FSProvider). In that case it uses the singleton directly with no reactivity.

### Sound Recorder

Saves WAV metadata nodes under `C:\Programs\Accessories\Sound Recorder\` using `fsStore.createFile(...)` with `fileType: "wav"` and `appId: "sound-recorder"`. Audio data is stored in IndexedDB (exception to the FS-only rule because IDB handles binary efficiently; the FS node is the metadata record and desktop shortcut anchor).

After saving, fires `onFileSaved(name)` so `NsDoors97.tsx` creates a desktop shortcut pointing to the recording.

Clicking a `.wav` file with `appId === "sound-recorder"` — whether from the desktop or `FilesApp` — opens Sound Recorder pre-loaded with that recording.

### Duck & Learn

Reads and writes `DH_SCORES_ID` with plain-text score content. The file lives in `C:\Programs\Games\Duck & Learn\SCORES.DAT`.

### Typing Racer

Reads and writes `TR_SCORES_ID`. The file lives in `C:\Programs\Games\Typing Racer\SCORES.DAT`. If the Typing Racer folder did not exist in an old session, `migrate()` creates it along with the `SCORES.DAT` file.

### NS-TOS terminal

Uses folder IDs as the current working directory (`cwd`). `CD`, `DIR`, `TYPE`, `MKDIR`, `RMDIR`, `DEL`, `REN`, and `ECHO text > file` all operate on `fsStore`. `HELL.EXE` can only be run when the cwd contains a file with `appId === "tos-only"`.

## Desktop icon rendering

`NsDoors97.tsx` calls `store.getChildren(DESKTOP_ID)` reactively.

- Nodes where `node.system === true` render in the **left** icon column (My Doors, Dumpster). These are undeletable.
- Nodes where `node.system === false` render in the **right** icon column (README.txt, user-saved shortcuts, files).

Double-clicking (or single-tap on touch) any desktop node calls `openFSNode(nodeId)`, which dispatches based on node kind and file type.

Icons animate in one-by-one after boot in randomized order, with occasional cursor-wait flashes to simulate a slow system initialising.

## The "hackable" philosophy

NS Doors 97 is intentionally hackable. Editing files in the fake OS should have real effects:

- **Score files** — `SCORES.DAT` files are plain JSON or numeric text. Open one in Notebook, edit it, save — the game reads the changed value on next load. This is intentional.
- **Config files** — `win.ini` and `system.ini` exist in `C:\System\`. Settings in them should progressively become wired to real OS behavior (desktop color, screensaver, etc.). Currently they are decorative; future agents should wire them up.
- **Desktop** — users can create shortcuts and files; system nodes are protected. User-created shortcuts added by Notebook or Sound Recorder appear automatically.
- **App assets (future)** — sprite and image files in the FS will override bundled `/public/` assets when non-empty (path-based detection). A user could draw a new HELL enemy sprite in NS Art, save it at the matching path, and the game uses it.

## Rules for new apps

1. Every app that persists data **must** use `fsStore`. No direct `localStorage` calls, no custom IDB keys (except for binary blobs like audio data where the FS node acts as a metadata anchor).
2. Add the app's data files to `seed.ts` with a stable ID and add a corresponding block to `migrate()`.
3. Score files should use `fileType: "dat"` and store human-readable content (plain numbers or JSON) so Notebook can display them.
4. Do not call `fsStore.batch()` from inside a React render. Use it only in setup code, seed, or migration.

## Future work

- **StorageAdapter swap** — replace `LocalStorageAdapter` with an IndexedDB adapter. No API changes required; swap the adapter passed to the `FileSystemStore` constructor.
- **Asset override system** — if an FS file at a path matching a bundled `/public/` asset has non-empty content, the app uses that content instead. Enables in-game sprite editing via NS Art.
- **NS-TOS completeness** — add `COPY`, `MOVE`, `TYPE` with piping, wildcard expansion.
- **Config file effects** — wire `win.ini` / `system.ini` entries to real OS behavior (screensaver choice, desktop color, beep toggle, etc.).
- **Richer file metadata** — file size display (based on `content.length`), last-modified timestamps in `FilesApp` status bar.
- **Folder navigation from desktop** — double-clicking a folder on the desktop should open `FilesApp` navigated to that folder, not just open the root My Doors window.
