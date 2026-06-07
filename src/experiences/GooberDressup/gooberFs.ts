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

// ── Sprite FS integration ─────────────────────────────────────────────────────

export function saveGooberSprite(layerKey: string, nsArtBackupJson: string): void {
  const fileName = `${layerKey}.nsart`;
  const existing = fsStore.findChild(GOOBER_SPRITES_ID, fileName);
  if (existing?.kind === "file") {
    fsStore.writeFile(existing.id, nsArtBackupJson);
  } else {
    fsStore.createFile(GOOBER_SPRITES_ID, fileName, {
      fileType: "dat",
      content: nsArtBackupJson,
    });
  }
}

interface NsArtBackup {
  version: 2;
  frameW: number;
  frameH: number;
  strips: { name: string }[];
  frames: (string | null)[][];
}

async function dataUrlToImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function loadGooberSprites(): Promise<Map<string, HTMLImageElement[]>> {
  const result = new Map<string, HTMLImageElement[]>();

  await Promise.all(
    GOOBER_LAYER_TARGETS.map(async ({ key }) => {
      const file = fsStore.findChild(GOOBER_SPRITES_ID, `${key}.nsart`);
      if (!file || file.kind !== "file" || !file.content) return;
      try {
        const backup = JSON.parse(file.content) as NsArtBackup;
        if (backup.version !== 2 || !Array.isArray(backup.frames[0])) return;
        const strip0 = backup.frames[0];
        const maybeImgs = await Promise.all(
          strip0.map(async url => {
            if (!url) return null;
            try { return await dataUrlToImage(url); }
            catch { return null; }
          })
        );
        const imgs = maybeImgs.filter((img): img is HTMLImageElement => img !== null);
        if (imgs.length > 0) result.set(key, imgs);
      } catch { /* parse error */ }
    })
  );

  return result;
}
