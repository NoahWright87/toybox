/**
 * FS-override hook for sprite art — the Doors 97 "asset override" vision
 * (see root CLAUDE.md, "App assets (future)") applied to SHMUP: a non-empty
 * virtual-FS file at the matching path wins over the bundled asset.
 *
 * SHMUP is a separately-built Vite bundle served full-page at /shmup/ (not
 * embedded in the Doors 97 React app — see games/shmup/README.md), so it
 * can't import the live `fsStore` singleton from
 * src/experiences/NsDoors97/filesystem without pulling the whole Doors 97
 * app (React, the full desktop seed data) into this package's bundle. Both
 * apps run on the same origin and share localStorage, so this is a
 * read-only peek at the same "ns97_fs_v1" key, mirroring just the
 * getNodeByPath/getChildren traversal in FileSystemStore.ts against the
 * same node shape. SHMUP never writes through this path — only Doors 97
 * (NS Art, Notebook, the file browser) creates or edits these files.
 */

const FS_STORAGE_KEY = "ns97_fs_v1";
const ROOT_ID = "fs:root";

/** The conventional FS folder sprite overrides live under, mirroring assets/sprites/. */
export const SHMUP_SPRITES_FS_DIR = "C:\\Programs\\Games\\SHMUP\\Sprites\\";

interface FsNodeLite {
  id: string;
  kind: "file" | "folder" | "shortcut";
  name: string;
  parentId: string | null;
  content?: string;
}

/** Maps a manifest-relative path (e.g. "ships/ship_player_idle_01.png") to its FS override path. */
export function spriteOverridePath(relativePath: string): string {
  return SHMUP_SPRITES_FS_DIR + relativePath.replace(/\//g, "\\");
}

function childByName(
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

/** Resolves an FS path (e.g. "C:\\Programs\\...\\foo.png") to its file content, if a non-empty file exists there. */
export function resolveFsOverride(
  nodes: Map<string, FsNodeLite>,
  fsPath: string
): string | undefined {
  const parts = fsPath
    .replace(/^C:\\/, "")
    .replace(/\\$/, "")
    .split("\\")
    .filter(Boolean);
  let currentId = ROOT_ID;
  for (const part of parts) {
    const match = childByName(nodes, currentId, part);
    if (!match) return undefined;
    currentId = match.id;
  }
  const node = nodes.get(currentId);
  if (node?.kind === "file" && node.content) return node.content;
  return undefined;
}

function readFsNodes(): Map<string, FsNodeLite> | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(FS_STORAGE_KEY);
    if (!raw) return undefined;
    return new Map(JSON.parse(raw) as [string, FsNodeLite][]);
  } catch {
    return undefined;
  }
}

/**
 * Returns the FS file content (expected to be a data URL) for a sprite's
 * override path, or undefined if no non-empty override exists.
 */
export function getSpriteOverrideUrl(relativePath: string): string | undefined {
  const nodes = readFsNodes();
  if (!nodes) return undefined;
  return resolveFsOverride(nodes, spriteOverridePath(relativePath));
}
