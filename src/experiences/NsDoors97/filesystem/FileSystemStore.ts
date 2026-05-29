import {
  type FSNode, type FSFile, type FSFolder, type FSShortcut, type FSFileType,
  ROOT_ID, DUMPSTER_ID, NS_ART_BACKUP_ID, DH_SCORES_ID, TR_SCORES_ID, SYSTEM_INI_ID,
} from "./types";
import { StorageAdapter, LocalStorageAdapter } from "./StorageAdapter";
import { seedFileSystem } from "./seed";

const FS_KEY = "ns97_fs_v1";

type Listener = () => void;

function genId(): string {
  return "fs:" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export class FileSystemStore {
  private nodes: Map<string, FSNode> = new Map();
  private adapter: StorageAdapter;
  private listeners = new Set<Listener>();
  private batching = false;

  readonly rootId    = ROOT_ID;
  readonly dumpsterId = DUMPSTER_ID;

  constructor(adapter: StorageAdapter = new LocalStorageAdapter()) {
    this.adapter = adapter;
    this.load();
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  getNode(id: string): FSNode | undefined {
    return this.nodes.get(id);
  }

  getFolder(id: string): FSFolder | undefined {
    const n = this.nodes.get(id);
    return n?.kind === "folder" ? n : undefined;
  }

  getFile(id: string): FSFile | undefined {
    const n = this.nodes.get(id);
    return n?.kind === "file" ? n : undefined;
  }

  getShortcut(id: string): FSShortcut | undefined {
    const n = this.nodes.get(id);
    return n?.kind === "shortcut" ? n : undefined;
  }

  getChildren(folderId: string): FSNode[] {
    const results: FSNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.parentId === folderId) results.push(node);
    }
    return results.sort((a, b) => {
      if (a.kind === "folder" && b.kind !== "folder") return -1;
      if (a.kind !== "folder" && b.kind === "folder") return 1;
      return a.name.localeCompare(b.name);
    });
  }

  getPath(id: string): string {
    if (id === ROOT_ID) return "C:\\";
    const parts: string[] = [];
    let current: FSNode | undefined = this.nodes.get(id);
    while (current && current.id !== ROOT_ID) {
      parts.unshift(current.name);
      const pid = current.parentId;
      if (!pid || pid === ROOT_ID) break;
      current = this.nodes.get(pid);
    }
    return "C:\\" + parts.join("\\");
  }

  getNodeByPath(path: string): FSNode | undefined {
    const normalized = path.replace(/^C:\\/, "").replace(/\\$/, "");
    if (!normalized) return this.nodes.get(ROOT_ID);
    const parts = normalized.split("\\").filter(Boolean);
    let currentId = ROOT_ID;
    for (const part of parts) {
      const match = this.getChildren(currentId).find(
        (n) => n.name.toLowerCase() === part.toLowerCase()
      );
      if (!match) return undefined;
      currentId = match.id;
    }
    return this.nodes.get(currentId);
  }

  findChild(folderId: string, name: string): FSNode | undefined {
    return this.getChildren(folderId).find(
      (n) => n.name.toLowerCase() === name.toLowerCase()
    );
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  createFile(
    parentId: string,
    name: string,
    options: {
      content?: string;
      mimeType?: string;
      fileType?: FSFileType;
      appId?: string;
      system?: boolean;
      readonly?: boolean;
      id?: string;
    } = {}
  ): FSFile {
    const file: FSFile = {
      id: options.id ?? genId(),
      kind: "file",
      name,
      parentId,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      fileType: options.fileType ?? "text",
      content: options.content ?? "",
      mimeType: options.mimeType ?? "text/plain",
      system: options.system ?? false,
      readonly: options.readonly ?? false,
      ...(options.appId !== undefined ? { appId: options.appId } : {}),
    };
    this.nodes.set(file.id, file);
    this.flush();
    return file;
  }

  createFolder(
    parentId: string | null,
    name: string,
    options: { system?: boolean; id?: string } = {}
  ): FSFolder {
    const folder: FSFolder = {
      id: options.id ?? genId(),
      kind: "folder",
      name,
      parentId,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      system: options.system ?? false,
    };
    this.nodes.set(folder.id, folder);
    this.flush();
    return folder;
  }

  createShortcut(
    parentId: string,
    name: string,
    options: {
      targetAppId?: string;
      targetFilePath?: string;
      system?: boolean;
      id?: string;
    } = {}
  ): FSShortcut {
    const shortcut: FSShortcut = {
      id: options.id ?? genId(),
      kind: "shortcut",
      name,
      parentId,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      system: options.system ?? false,
      ...(options.targetAppId    !== undefined ? { targetAppId: options.targetAppId }       : {}),
      ...(options.targetFilePath !== undefined ? { targetFilePath: options.targetFilePath } : {}),
    };
    this.nodes.set(shortcut.id, shortcut);
    this.flush();
    return shortcut;
  }

  ensureFile(
    parentId: string,
    name: string,
    options: {
      content?: string;
      mimeType?: string;
      fileType?: FSFileType;
      appId?: string;
      system?: boolean;
      readonly?: boolean;
    } = {}
  ): FSFile {
    const existing = this.findChild(parentId, name);
    if (existing?.kind === "file") return existing;
    return this.createFile(parentId, name, options);
  }

  writeFile(id: string, content: string, mimeType?: string): void {
    const node = this.nodes.get(id);
    if (!node || node.kind !== "file") return;
    this.nodes.set(id, {
      ...node,
      content,
      modifiedAt: Date.now(),
      ...(mimeType !== undefined ? { mimeType } : {}),
    });
    this.flush();
  }

  renameNode(id: string, newName: string): void {
    const node = this.nodes.get(id);
    if (!node || node.system) return;
    this.nodes.set(id, { ...node, name: newName, modifiedAt: Date.now() } as FSNode);
    this.flush();
  }

  moveNode(id: string, newParentId: string): void {
    const node = this.nodes.get(id);
    if (!node) return;
    this.nodes.set(id, { ...node, parentId: newParentId } as FSNode);
    this.flush();
  }

  deleteNode(id: string): void {
    const node = this.nodes.get(id);
    if (!node || node.system) return;
    if (node.parentId === DUMPSTER_ID) {
      this.permanentDelete(id);
      return;
    }
    this.moveNode(id, DUMPSTER_ID);
  }

  permanentDelete(id: string): void {
    this._deleteSubtree(id);
    this.flush();
  }

  emptyDumpster(): void {
    const children = this.getChildren(DUMPSTER_ID);
    for (const child of children) {
      this._deleteSubtree(child.id);
    }
    this.flush();
  }

  // ── Batching ─────────────────────────────────────────────────────────────────

  batch(fn: () => void): void {
    this.batching = true;
    try { fn(); }
    finally {
      this.batching = false;
      this.save();
      this.emit();
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── Dev / testing ─────────────────────────────────────────────────────────────

  reset(): void {
    this.nodes.clear();
    this.batch(() => seedFileSystem(this));
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _deleteSubtree(id: string): void {
    const queue = [id];
    while (queue.length) {
      const current = queue.pop()!;
      for (const child of this.getChildren(current)) {
        queue.push(child.id);
      }
      this.nodes.delete(current);
    }
  }

  private flush(): void {
    if (!this.batching) {
      this.save();
      this.emit();
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private save(): void {
    const entries = [...this.nodes.entries()];
    this.adapter.setItem(FS_KEY, JSON.stringify(entries));
  }

  private load(): void {
    const raw = this.adapter.getItem(FS_KEY);
    if (raw) {
      try {
        const entries = JSON.parse(raw) as [string, FSNode][];
        this.nodes = new Map<string, FSNode>(entries);
        this.migrate();
        return;
      } catch {
        console.warn("[FS] Corrupt data, re-seeding");
      }
    }
    this.batch(() => seedFileSystem(this));
  }

  private migrate(): void {
    let changed = false;

    // Ensure NS Art backup file exists with its stable ID
    if (!this.nodes.has(NS_ART_BACKUP_ID)) {
      const nsArtDir = this.getNodeByPath("C:\\Programs\\Accessories\\NS Art");
      if (nsArtDir?.kind === "folder") {
        this.nodes.set(NS_ART_BACKUP_ID, {
          id: NS_ART_BACKUP_ID, kind: "file", name: "Untitled.nsart",
          parentId: nsArtDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "dat", content: "", mimeType: "application/json",
          system: false, readonly: false, appId: "nsart",
        } as FSFile);
        changed = true;
      }
    }

    // Ensure Duck & Learn SCORES.DAT exists with its stable ID
    if (!this.nodes.has(DH_SCORES_ID)) {
      const dhDir = this.getNodeByPath("C:\\Programs\\Games\\Duck & Learn");
      if (dhDir?.kind === "folder") {
        const existing = this.findChild(dhDir.id, "SCORES.DAT");
        if (existing?.kind === "file") {
          // Re-register existing file under stable ID (keeping its content)
          this.nodes.delete(existing.id);
          this.nodes.set(DH_SCORES_ID, { ...existing, id: DH_SCORES_ID });
        } else {
          this.nodes.set(DH_SCORES_ID, {
            id: DH_SCORES_ID, kind: "file", name: "SCORES.DAT",
            parentId: dhDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
            fileType: "dat", content: "", mimeType: "text/plain",
            system: false, readonly: false,
          } as FSFile);
        }
        changed = true;
      }
    }

    // Ensure Typing Racer folder + SCORES.DAT exist
    if (!this.nodes.has(TR_SCORES_ID)) {
      let trDir = this.getNodeByPath("C:\\Programs\\Games\\Typing Racer");
      if (!trDir) {
        const gamesDir = this.getNodeByPath("C:\\Programs\\Games");
        if (gamesDir?.kind === "folder") {
          const folder: FSFolder = {
            id: "fs:games-tr", kind: "folder", name: "Typing Racer",
            parentId: gamesDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
            system: false,
          };
          this.nodes.set(folder.id, folder);
          this.nodes.set("fs:games-tr-exe", {
            id: "fs:games-tr-exe", kind: "file", name: "Typing Racer.exe",
            parentId: folder.id, createdAt: Date.now(), modifiedAt: Date.now(),
            fileType: "exe", content: "", mimeType: "application/octet-stream",
            system: false, readonly: false, appId: "typing-racer",
          } as FSFile);
          trDir = folder;
        }
      }
      if (trDir?.kind === "folder") {
        this.nodes.set(TR_SCORES_ID, {
          id: TR_SCORES_ID, kind: "file", name: "SCORES.DAT",
          parentId: trDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "dat", content: "", mimeType: "text/plain",
          system: false, readonly: false,
        } as FSFile);
        changed = true;
      }
    }

    // Rename win.ini → doors.ini for existing sessions
    const winIni = this.getNodeByPath("C:\\System\\win.ini");
    if (winIni?.kind === "file") {
      const doorsIniContent = `; doors.ini — Noahsoft configuration placeholder\n; Future home of user preferences, registered app associations,\n; and other settings too important to put in system.ini but\n; too silly not to customize.\n;\n; "A mind is like a computer: it works best when you clear the cache." — Gerald\n;\n; Coming in NS Doors 98:\n;   [FavoriteJokes]   JokeCount=0\n;   [WallpaperMood]   Monday=sad  Friday=happy\n;   [Gerald]          CalledToday=no\n`;
      // Replace win.ini with doors.ini
      this.nodes.delete(winIni.id);
      this.nodes.set("fs:sys-doors-ini", {
        id: "fs:sys-doors-ini", kind: "file", name: "doors.ini",
        parentId: winIni.parentId, createdAt: Date.now(), modifiedAt: Date.now(),
        fileType: "ini", content: doorsIniContent, mimeType: "text/plain",
        system: false, readonly: false,
      } as FSFile);
      changed = true;
    }

    // Ensure system.ini has a stable ID and is editable; add [Desktop]/[Screen] if missing
    if (!this.nodes.has(SYSTEM_INI_ID)) {
      const sysDir = this.getNodeByPath("C:\\System");
      if (sysDir?.kind === "folder") {
        const existing = this.findChild(sysDir.id, "system.ini");
        let content = existing?.kind === "file" ? existing.content : "";
        // Append Desktop/Screen sections if not present
        if (!content.includes("[Desktop]")) {
          content += "\n[Desktop]\n; Background: noahsoft, solid, or wallpaper\nBackground=solid\n; Color used when Background=solid\nColor=#cc4400\n; Wallpaper preset: sunset, arch, or (None)\nWallpaper=(None)\n; WallpaperFit: cover or contain\nWallpaperFit=cover\n";
        }
        if (!content.includes("[Screen]")) {
          content += "\n[Screen]\n; ScreenSaverActive: 0=off, 1=on\nScreenSaverActive=0\n; ScreenSaverTimeout in minutes (0=disabled)\nScreenSaverTimeout=1\n; ScreenSaver: starfield, fireworks, bouncing-shapes, scrolling-text,\n;              bouncing-polygons, raining-emojis, or (None)\nScreenSaver=(None)\n";
        }
        if (existing?.kind === "file") {
          this.nodes.delete(existing.id);
          this.nodes.set(SYSTEM_INI_ID, { ...existing, id: SYSTEM_INI_ID, content, readonly: false });
        } else {
          this.nodes.set(SYSTEM_INI_ID, {
            id: SYSTEM_INI_ID, kind: "file", name: "system.ini",
            parentId: sysDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
            fileType: "ini", content, mimeType: "text/plain",
            system: false, readonly: false,
          } as FSFile);
        }
        changed = true;
      }
    }

    // Ensure EGO/SPRITES contains PNG stubs (replace old BMP stubs if present)
    const spritesDir = this.getNodeByPath("C:\\EGO\\SPRITES");
    if (spritesDir?.kind === "folder") {
      const spriteNames = [
        "enemy-0.png", "enemy-1.png", "enemy-2.png", "enemy-dead.png",
        "gun-pistol.png", "gun-claws.png", "gun-flamethrower.png",
        "gun-subwoofer.png", "gun-woofer.png", "gun-tennis.png",
        "key-red.png", "key-blue.png", "key-green.png",
        "key-orange.png", "key-purple.png", "key-yellow.png",
        "pickup-health.png", "pickup-ammo.png", "pickup-fuel.png",
        "pickup-bullets.png", "pickup-balls.png",
        "pickup-weapon-woofer.png", "pickup-weapon-tennis.png", "pickup-weapon-flamethrower.png",
        "flame-particle.png", "projectile-tennis.png",
        "impact-wall.png", "impact-enemy.png",
        "target-dummy.png", "target-dummy-dead.png",
        "wall-rock.png", "wall-lava.png",
      ];
      // Remove any old BMP stubs
      for (const child of this.getChildren(spritesDir.id)) {
        if (child.kind === "file" && child.name.endsWith(".BMP")) {
          this.nodes.delete(child.id);
          changed = true;
        }
      }
      // Add PNG stubs that don't exist yet
      for (const name of spriteNames) {
        if (!this.findChild(spritesDir.id, name)) {
          const id = `fs:ego-spr-${name.replace(/\./g, "-")}`;
          this.nodes.set(id, {
            id, kind: "file", name,
            parentId: spritesDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
            fileType: "png", content: "", mimeType: "image/png",
            system: false, readonly: false,
          } as FSFile);
          changed = true;
        }
      }
    }

    // Ensure EGO/SOUNDS folder and WAV stubs exist
    const egoDir = this.getNodeByPath("C:\\EGO");
    if (egoDir?.kind === "folder" && !this.getNodeByPath("C:\\EGO\\SOUNDS")) {
      const sDirId = "fs:ego-sounds";
      const newSoundsDir: FSFolder = {
        id: sDirId, kind: "folder", name: "SOUNDS",
        parentId: egoDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
        system: false,
      };
      this.nodes.set(sDirId, newSoundsDir);
      const soundNames = [
        "intro.wav", "shoot.wav", "hit-wall.wav", "hit-enemy.wav",
        "hurt.wav", "death.wav", "level-complete.wav",
        "pickup.wav", "pickup-weapon.wav", "weapon-switch.wav",
        "alert.wav", "door-open.wav",
        "shoot-subwoofer.wav", "shoot-woofer.wav", "swipe-claws.wav", "hit-claws.wav",
        "shoot-tennis.wav", "bounce-tennis.wav",
        "shoot-flamethrower.wav", "burning.wav",
      ];
      for (const name of soundNames) {
        const sid = `fs:ego-snd-${name.replace(/\./g, "-")}`;
        this.nodes.set(sid, {
          id: sid, kind: "file", name,
          parentId: sDirId, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "wav", content: "", mimeType: "audio/wav",
          system: false, readonly: false,
        } as FSFile);
      }
      changed = true;
    }

    if (changed) this.save();
  }
}

export const fsStore = new FileSystemStore();
