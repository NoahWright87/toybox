import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import type { FSFile } from "../NsDoors97/filesystem/types";
import { GOOBER_FOLDER_ID, GOOBER_SPRITES_ID } from "../NsDoors97/filesystem/types";

export { GOOBER_FOLDER_ID, GOOBER_SPRITES_ID };

export interface GooberConfig {
  version: 1;
  background: number;
  bodyShape: number;
  bodyOutfit: number;
  ears: number;
  noseWhiskers: number;
  mouth: number;
  eyes: number;
  glasses: number;
  necklace: number;
  hat: number;
  heldItem: number;
}

export const DEFAULT_CONFIG: GooberConfig = {
  version: 1,
  background: 0,
  bodyShape: 0,
  bodyOutfit: 0,
  ears: 0,
  noseWhiskers: 0,
  mouth: 0,
  eyes: 0,
  glasses: 0,
  necklace: 0,
  hat: 0,
  heldItem: 0,
};

export const GOOBER_LAYER_TARGETS = [
  { key: "background",   label: "Background"      },
  { key: "bodyShape",    label: "Body Shape"       },
  { key: "bodyOutfit",   label: "Outfit"           },
  { key: "ears",         label: "Ears"             },
  { key: "noseWhiskers", label: "Nose & Whiskers"  },
  { key: "mouth",        label: "Mouth"            },
  { key: "eyes",         label: "Eyes"             },
  { key: "glasses",      label: "Glasses"          },
  { key: "necklace",     label: "Necklace"         },
  { key: "hat",          label: "Hat"              },
  { key: "heldItem",     label: "Held Item"        },
] as const;

export type GooberLayerKey = (typeof GOOBER_LAYER_TARGETS)[number]["key"];

// Stable FS ID for a single frame of a layer
export function gooberSpriteFileId(layerKey: string, frameIdx: number): string {
  return `fs:goober-spr-${layerKey}-${frameIdx}`;
}

// ── Config save / load ────────────────────────────────────────────────────────

export function saveGoober(name: string, config: GooberConfig): void {
  const fileName = `${name}.DAT`;
  const content = JSON.stringify(config);
  const existing = fsStore.findChild(GOOBER_FOLDER_ID, fileName);
  if (existing?.kind === "file") {
    fsStore.writeFile(existing.id, content);
  } else {
    fsStore.createFile(GOOBER_FOLDER_ID, fileName, {
      fileType: "dat",
      content,
      appId: "goober-dressup",
    });
  }
}

export function loadGoober(fileId: string): GooberConfig | null {
  const file = fsStore.getFile(fileId);
  if (!file?.content) return null;
  try {
    const parsed = JSON.parse(file.content) as { version?: number };
    if (parsed.version !== 1) return null;
    return parsed as GooberConfig;
  } catch {
    return null;
  }
}

export function listGoobers(): { id: string; name: string }[] {
  return fsStore
    .getChildren(GOOBER_FOLDER_ID)
    .filter((n): n is FSFile => n.kind === "file" && (n as FSFile).appId === "goober-dressup")
    .map(n => ({ id: n.id, name: n.name.replace(/\.DAT$/i, "") }));
}

// ── Sprite FS integration — individual PNG files per frame ────────────────────

// Save all frames for a layer as individual PNG files in the Sprites folder.
// Frames are stored at C:\Programs\Games\Goober Dress-Up\Sprites\{key}-{i}.png
// Each file's content is a PNG data URL.
// Extra frames from a previous save (if new count < old count) are cleared.
export function saveGooberLayer(layerKey: string, pngDataUrls: (string | null)[]): void {
  // Collect non-null urls (stop at first null — maintains frame order)
  const urls: string[] = [];
  for (const url of pngDataUrls) {
    if (!url) break;
    urls.push(url);
  }

  // Count existing frames
  let existingCount = 0;
  while (fsStore.getFile(gooberSpriteFileId(layerKey, existingCount))) {
    existingCount++;
  }

  fsStore.batch(() => {
    // Write / create each new frame
    urls.forEach((url, i) => {
      const id = gooberSpriteFileId(layerKey, i);
      if (fsStore.getFile(id)) {
        fsStore.writeFile(id, url);
      } else {
        fsStore.createFile(GOOBER_SPRITES_ID, `${layerKey}-${i}.png`, {
          fileType: "png", appId: "nsart", content: url, id,
        });
      }
    });
    // Clear any extra frames beyond the new count
    for (let i = urls.length; i < existingCount; i++) {
      fsStore.writeFile(gooberSpriteFileId(layerKey, i), "");
    }
  });
}

async function dataUrlToImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Load all layer sprites from the FS.
// Reads {key}-0.png, {key}-1.png, ... until a file is missing or has empty content.
export async function loadGooberSprites(): Promise<Map<string, HTMLImageElement[]>> {
  const result = new Map<string, HTMLImageElement[]>();

  await Promise.all(
    GOOBER_LAYER_TARGETS.map(async ({ key }) => {
      const imgs: HTMLImageElement[] = [];
      let i = 0;
      while (true) {
        const file = fsStore.getFile(gooberSpriteFileId(key, i));
        if (!file?.content) break;
        try {
          imgs.push(await dataUrlToImage(file.content));
        } catch {
          break;
        }
        i++;
      }
      if (imgs.length > 0) result.set(key, imgs);
    })
  );

  return result;
}
