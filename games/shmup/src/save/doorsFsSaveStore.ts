/**
 * Default SaveStore — persists into the Doors 97 virtual filesystem so
 * saves/settings show up in the file browser (the hackable-FS vision; see
 * root CLAUDE.md "Unified Virtual Filesystem"). SHMUP is a separately-built
 * Vite bundle served full-page at /shmup/, not embedded in the Doors 97
 * React app, so importing the live `fsStore` singleton would pull the whole
 * Doors app (React, the full desktop seed data) into this package's bundle.
 * Both apps run on the same origin and share localStorage, so this is a
 * same-origin reader/writer of the shared "ns97_fs_v1" blob, mirroring just
 * the slice of FileSystemStore's node shape and mutation logic this needs —
 * the same precedent as ../sprites/fsOverride.ts, but read-write instead of
 * read-only.
 *
 * The target folder (C:\Programs\Games\SHMUP\Saves\) is seeded by the main
 * app in filesystem/seed.ts and filesystem/migrate() under the stable id
 * SHMUP_SAVES_ID, so this store can address it directly without a path
 * walk. If that folder doesn't exist yet (e.g. /shmup/ was hit on an origin
 * that has never loaded Doors 97), writes bootstrap the same chain of
 * stable ids Doors itself uses, so a later Doors load recognizes and merges
 * with it instead of creating a duplicate.
 */
import type { SaveStore } from "./types";

const FS_STORAGE_KEY = "ns97_fs_v1";
const ROOT_ID = "fs:root";
const PROGRAMS_ID = "fs:programs";
const GAMES_ID = "fs:games";
const SHMUP_FOLDER_ID = "fs:shmup";
const SHMUP_SAVES_ID = "fs:shmup-saves";

// Metadata fields beyond id/kind/name/parentId/content are optional here so
// tests can build minimal fixtures; writeSave/ensureSavesFolder always fill
// every field with a concrete value when they create a node, matching the
// real Doors FSFile/FSFolder shape (filesystem/types.ts) the file browser expects.
interface FsFileLite {
  id: string;
  kind: "file";
  name: string;
  parentId: string | null;
  content?: string;
  createdAt?: number;
  modifiedAt?: number;
  fileType?: string;
  mimeType?: string;
  system?: boolean;
  readonly?: boolean;
}

interface FsFolderLite {
  id: string;
  kind: "folder";
  name: string;
  parentId: string | null;
  createdAt?: number;
  modifiedAt?: number;
  system?: boolean;
}

type FsNodeLite = FsFileLite | FsFolderLite;

function genId(): string {
  return "fs:" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** SaveStore keys map to DOS-flavored filenames, matching SCORES.DAT/SAVE.DAT elsewhere in the FS. */
export function saveFileName(key: string): string {
  return key.toUpperCase() + ".DAT";
}

function keyFromFileName(name: string): string {
  return name.replace(/\.DAT$/i, "").toLowerCase();
}

export function findChild(
  nodes: Map<string, FsNodeLite>,
  parentId: string,
  name: string
): FsNodeLite | undefined {
  const lower = name.toLowerCase();
  for (const node of nodes.values()) {
    if (node.parentId === parentId && node.name.toLowerCase() === lower) return node;
  }
  return undefined;
}

/** Idempotent: creates any missing link in the ROOT > Programs > Games > SHMUP > Saves chain, using Doors' own stable ids, without touching nodes that already exist. */
export function ensureSavesFolder(nodes: Map<string, FsNodeLite>): string {
  const ensureFolder = (id: string, name: string, parentId: string | null) => {
    const existing = nodes.get(id);
    if (existing?.kind === "folder") return;
    const now = Date.now();
    nodes.set(id, { id, kind: "folder", name, parentId, createdAt: now, modifiedAt: now, system: false });
  };
  ensureFolder(ROOT_ID, "C:", null);
  ensureFolder(PROGRAMS_ID, "Programs", ROOT_ID);
  ensureFolder(GAMES_ID, "Games", PROGRAMS_ID);
  ensureFolder(SHMUP_FOLDER_ID, "SHMUP", GAMES_ID);
  ensureFolder(SHMUP_SAVES_ID, "Saves", SHMUP_FOLDER_ID);
  return SHMUP_SAVES_ID;
}

export function readSave(nodes: Map<string, FsNodeLite>, key: string): string | null {
  if (!nodes.has(SHMUP_SAVES_ID)) return null;
  const file = findChild(nodes, SHMUP_SAVES_ID, saveFileName(key));
  return file?.kind === "file" ? file.content ?? null : null;
}

export function writeSave(nodes: Map<string, FsNodeLite>, key: string, value: string): void {
  const savesId = ensureSavesFolder(nodes);
  const name = saveFileName(key);
  const existing = findChild(nodes, savesId, name);
  const now = Date.now();
  if (existing?.kind === "file") {
    nodes.set(existing.id, { ...existing, content: value, modifiedAt: now });
    return;
  }
  const id = genId();
  nodes.set(id, {
    id, kind: "file", name, parentId: savesId,
    createdAt: now, modifiedAt: now,
    fileType: "dat", content: value, mimeType: "text/plain",
    system: false, readonly: false,
  });
}

export function removeSave(nodes: Map<string, FsNodeLite>, key: string): void {
  if (!nodes.has(SHMUP_SAVES_ID)) return;
  const file = findChild(nodes, SHMUP_SAVES_ID, saveFileName(key));
  if (file) nodes.delete(file.id);
}

export function listSaves(nodes: Map<string, FsNodeLite>, prefix: string): string[] {
  if (!nodes.has(SHMUP_SAVES_ID)) return [];
  const upperPrefix = prefix.toUpperCase();
  const out: string[] = [];
  for (const node of nodes.values()) {
    if (node.parentId === SHMUP_SAVES_ID && node.kind === "file" && node.name.toUpperCase().startsWith(upperPrefix)) {
      out.push(keyFromFileName(node.name));
    }
  }
  return out;
}

function loadNodes(): Map<string, FsNodeLite> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(FS_STORAGE_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw) as [string, FsNodeLite][]);
  } catch {
    return new Map();
  }
}

function persistNodes(nodes: Map<string, FsNodeLite>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FS_STORAGE_KEY, JSON.stringify([...nodes.entries()]));
  } catch {
    /* quota exceeded or storage disabled — silently drop, mirrors StorageAdapter.ts */
  }
}

export class DoorsFsSaveStore implements SaveStore {
  read(key: string): string | null {
    return readSave(loadNodes(), key);
  }

  write(key: string, value: string): void {
    const nodes = loadNodes();
    writeSave(nodes, key, value);
    persistNodes(nodes);
  }

  remove(key: string): void {
    const nodes = loadNodes();
    removeSave(nodes, key);
    persistNodes(nodes);
  }

  list(prefix: string): string[] {
    return listSaves(loadNodes(), prefix);
  }
}
