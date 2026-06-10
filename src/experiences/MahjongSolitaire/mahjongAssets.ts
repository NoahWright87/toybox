import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";

/**
 * Resolves a Mahjong tile face to either the user's custom version (painted
 * in NS Art and stored in the virtual FS) or the original bundled SVG.
 *
 * Mirrors the Hellzone `assetOverride.ts` pattern: checks
 * `C:\Programs\Games\Mahjong Solitaire\TILES\{designId}.png` in the FS for
 * non-empty content. The FS file content is expected to be a data URL
 * (e.g. "data:image/png;base64,..."). If the FS file doesn't exist or has
 * empty content, the bundled `defaultSvgPath` is used.
 */
const TILES_FS_DIR = "C:\\Programs\\Games\\Mahjong Solitaire\\TILES\\";

export function getTileAssetUrl(designId: string, defaultSvgPath: string): string {
  const fsPath = TILES_FS_DIR + designId + ".png";
  const node = fsStore.getNodeByPath(fsPath);
  if (node?.kind === "file" && node.content) return node.content;
  return defaultSvgPath;
}
