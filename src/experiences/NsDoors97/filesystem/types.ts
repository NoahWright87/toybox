// Well-known folder IDs — stable across reloads, used for direct navigation
export const ROOT_ID          = "fs:root";
export const DESKTOP_ID       = "fs:desktop";
export const DUMPSTER_ID      = "fs:dumpster";
export const DOCUMENTS_ID     = "fs:documents";
export const PROGRAMS_ID      = "fs:programs";
export const GAMES_ID         = "fs:games";
export const ACC_ID           = "fs:accessories";
export const SYSTEM_ID        = "fs:system";
export const DOWNLOADS_ID     = "fs:downloads";
export const EGO_ID           = "fs:ego";
// Stable IDs for app-owned files that need reliable direct access
export const NS_ART_BACKUP_ID = "fs:nsart-backup";
export const DH_SCORES_ID     = "fs:scores-dh";
export const TR_SCORES_ID     = "fs:scores-tr";

export type FSFileType =
  | "text" | "exe" | "bat" | "sys" | "scr" | "drv"
  | "tmp"  | "zip" | "bmp" | "png" | "ini" | "wav" | "dat" | "lnk";

export interface FSFile {
  id: string;
  kind: "file";
  name: string;
  parentId: string;
  createdAt: number;
  modifiedAt: number;
  fileType: FSFileType;
  content: string;
  mimeType: string;
  system: boolean;
  readonly: boolean;
  appId?: string;
}

export interface FSFolder {
  id: string;
  kind: "folder";
  name: string;
  parentId: string | null;
  createdAt: number;
  modifiedAt: number;
  system: boolean;
}

export interface FSShortcut {
  id: string;
  kind: "shortcut";
  name: string;
  parentId: string;
  createdAt: number;
  modifiedAt: number;
  system: boolean;
  targetAppId?: string;
  targetFilePath?: string;
}

export type FSNode = FSFile | FSFolder | FSShortcut;

export const FILE_TYPE_ICONS: Record<FSFileType | "folder" | "shortcut", string> = {
  folder:   "📁",
  shortcut: "🔗",
  text:     "📄",
  exe:      "⚙️",
  bat:      "📜",
  sys:      "🔧",
  scr:      "🖥️",
  drv:      "🔩",
  tmp:      "🗒️",
  zip:      "📦",
  bmp:      "🖼️",
  png:      "🖼️",
  ini:      "📋",
  wav:      "🎵",
  dat:      "💾",
  lnk:      "🔗",
};

export function getNodeIcon(node: FSNode): string {
  if (node.kind === "folder")   return FILE_TYPE_ICONS.folder;
  if (node.kind === "shortcut") return FILE_TYPE_ICONS.shortcut;
  return FILE_TYPE_ICONS[node.fileType] ?? "📄";
}
