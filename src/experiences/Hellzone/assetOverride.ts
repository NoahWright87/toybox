import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";

/**
 * Resolves a public asset path to either the user's custom version (stored in
 * the virtual FS) or the original bundled file.
 *
 * /sprites/enemy-0.png  → checks C:\EGO\SPRITES\enemy-0.png in FS
 * /sounds/alert.wav     → checks C:\EGO\SOUNDS\alert.wav in FS
 *
 * The FS file content is expected to be a data URL (e.g. "data:image/png;base64,...").
 * If the FS file exists but has empty content, the bundled path is used as fallback.
 */
export function getAssetUrl(publicPath: string): string {
  let fsPath: string;
  if (publicPath.startsWith("/sprites/")) {
    fsPath = "C:\\EGO\\SPRITES\\" + publicPath.slice("/sprites/".length);
  } else if (publicPath.startsWith("/sounds/")) {
    fsPath = "C:\\EGO\\SOUNDS\\" + publicPath.slice("/sounds/".length);
  } else {
    return publicPath;
  }
  const node = fsStore.getNodeByPath(fsPath);
  if (node?.kind === "file" && node.content) return node.content;
  return publicPath;
}
