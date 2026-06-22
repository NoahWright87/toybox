import {
  type FSNode, type FSFile, type FSFolder, type FSShortcut, type FSFileType,
  ROOT_ID, DUMPSTER_ID, NS_ART_BACKUP_ID, DH_SCORES_ID, TR_SCORES_ID, SYSTEM_INI_ID,
  GOOBER_FOLDER_ID, GOOBER_SPRITES_ID, CK_SCORES_ID,
  MJ_SCORES_ID, MJ_TILES_FOLDER_ID, MJ_STATE_ID,
  JB_SCORES_ID, BB_SCORES_ID,
  JP_SCORES_ID, JP_STATE_ID, JP_IMAGE_ID,
  SHMUP_FOLDER_ID, SHMUP_EXE_ID,
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

    // Ensure SHMUP folder + SHMUP.EXE exist (existing sessions)
    if (!this.nodes.has(SHMUP_EXE_ID)) {
      let shmupDir = this.getNodeByPath("C:\\Programs\\Games\\SHMUP");
      if (!shmupDir) {
        const gamesDir = this.getNodeByPath("C:\\Programs\\Games");
        if (gamesDir?.kind === "folder") {
          const folder: FSFolder = {
            id: SHMUP_FOLDER_ID, kind: "folder", name: "SHMUP",
            parentId: gamesDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
            system: false,
          };
          this.nodes.set(folder.id, folder);
          shmupDir = folder;
        }
      }
      if (shmupDir?.kind === "folder") {
        this.nodes.set(SHMUP_EXE_ID, {
          id: SHMUP_EXE_ID, kind: "file", name: "SHMUP.EXE",
          parentId: shmupDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "exe", content: "", mimeType: "application/octet-stream",
          system: false, readonly: false, appId: "tos-only",
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

    // Ensure Mahjong Solitaire folder + SCORES.DAT exist
    let mjDir = this.getNodeByPath("C:\\Programs\\Games\\Mahjong Solitaire");
    if (!this.nodes.has(MJ_SCORES_ID)) {
      if (!mjDir) {
        const gamesDir = this.getNodeByPath("C:\\Programs\\Games");
        if (gamesDir?.kind === "folder") {
          const folder: FSFolder = {
            id: "fs:games-mj", kind: "folder", name: "Mahjong Solitaire",
            parentId: gamesDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
            system: false,
          };
          this.nodes.set(folder.id, folder);
          this.nodes.set("fs:games-mj-exe", {
            id: "fs:games-mj-exe", kind: "file", name: "Mahjong Solitaire.exe",
            parentId: folder.id, createdAt: Date.now(), modifiedAt: Date.now(),
            fileType: "exe", content: "", mimeType: "application/octet-stream",
            system: false, readonly: false, appId: "mahjong-solitaire",
          } as FSFile);
          mjDir = folder;
        }
      }
      if (mjDir?.kind === "folder") {
        this.nodes.set(MJ_SCORES_ID, {
          id: MJ_SCORES_ID, kind: "file", name: "SCORES.DAT",
          parentId: mjDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "dat", content: "", mimeType: "text/plain",
          system: false, readonly: false,
        } as FSFile);
        changed = true;
      }
    }

    // Ensure Mahjong SAVE.DAT (in-progress game state) exists
    if (!this.nodes.has(MJ_STATE_ID)) {
      mjDir = mjDir ?? this.getNodeByPath("C:\\Programs\\Games\\Mahjong Solitaire");
      if (mjDir?.kind === "folder") {
        this.nodes.set(MJ_STATE_ID, {
          id: MJ_STATE_ID, kind: "file", name: "SAVE.DAT",
          parentId: mjDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "dat", content: "", mimeType: "text/plain",
          system: false, readonly: false,
        } as FSFile);
        changed = true;
      }
    }

    // Ensure Mahjong TILES subfolder + tile face stubs exist
    if (!this.nodes.has(MJ_TILES_FOLDER_ID)) {
      mjDir = mjDir ?? this.getNodeByPath("C:\\Programs\\Games\\Mahjong Solitaire");
      if (mjDir?.kind === "folder") {
        this.nodes.set(MJ_TILES_FOLDER_ID, {
          id: MJ_TILES_FOLDER_ID, kind: "folder", name: "TILES",
          parentId: mjDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          system: false,
        } as FSFolder);

        const MJ_TILE_IDS = [
          "dots-1", "dots-2", "dots-3", "dots-4", "dots-5", "dots-6", "dots-7", "dots-8", "dots-9",
          "bamboo-1", "bamboo-2", "bamboo-3", "bamboo-4", "bamboo-5", "bamboo-6", "bamboo-7", "bamboo-8", "bamboo-9",
          "chars-1", "chars-2", "chars-3", "chars-4", "chars-5", "chars-6", "chars-7", "chars-8", "chars-9",
          "wind-east", "wind-south", "wind-west", "wind-north",
          "dragon-red", "dragon-green", "dragon-white",
          "flower-1", "flower-2",
        ];
        for (const tileId of MJ_TILE_IDS) {
          const id = `fs:mj-tile-${tileId}`;
          this.nodes.set(id, {
            id, kind: "file", name: `${tileId}.png`,
            parentId: MJ_TILES_FOLDER_ID,
            createdAt: Date.now(), modifiedAt: Date.now(),
            fileType: "png", content: "", mimeType: "image/png",
            system: false, readonly: false, appId: "nsart",
          } as FSFile);
        }
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
      // Add PNG stubs that don't exist yet; update existing ones to have appId
      for (const name of spriteNames) {
        const existing = this.findChild(spritesDir.id, name);
        if (existing?.kind === "file" && !existing.appId) {
          this.nodes.set(existing.id, { ...existing, appId: "nsart" });
          changed = true;
        } else if (!existing) {
          const id = `fs:ego-spr-${name.replace(/\./g, "-")}`;
          this.nodes.set(id, {
            id, kind: "file", name,
            parentId: spritesDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
            fileType: "png", content: "", mimeType: "image/png",
            system: false, readonly: false, appId: "nsart",
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
          system: false, readonly: false, appId: "sound-recorder",
        } as FSFile);
      }
      changed = true;
    }

    // Ensure Checkers folder + SCORES.DAT exist
    if (!this.nodes.has(CK_SCORES_ID)) {
      let ckDir = this.getNodeByPath("C:\\Programs\\Games\\Checkers");
      if (!ckDir) {
        const gamesDir = this.getNodeByPath("C:\\Programs\\Games");
        if (gamesDir?.kind === "folder") {
          const folder: FSFolder = {
            id: "fs:games-ck", kind: "folder", name: "Checkers",
            parentId: gamesDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
            system: false,
          };
          this.nodes.set(folder.id, folder);
          this.nodes.set("fs:games-ck-exe", {
            id: "fs:games-ck-exe", kind: "file", name: "Checkers.exe",
            parentId: folder.id, createdAt: Date.now(), modifiedAt: Date.now(),
            fileType: "exe", content: "", mimeType: "application/octet-stream",
            system: false, readonly: false, appId: "checkers",
          } as FSFile);
          ckDir = folder;
        }
      }
      if (ckDir?.kind === "folder") {
        this.nodes.set(CK_SCORES_ID, {
          id: CK_SCORES_ID, kind: "file", name: "SCORES.DAT",
          parentId: ckDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "dat", content: "", mimeType: "text/plain",
          system: false, readonly: false,
        } as FSFile);
        changed = true;
      }
    }

    // Ensure Jazzball folder + SCORES.DAT exist
    if (!this.nodes.has(JB_SCORES_ID)) {
      let jbDir = this.getNodeByPath("C:\\Programs\\Games\\Jazzball");
      if (!jbDir) {
        const gamesDir = this.getNodeByPath("C:\\Programs\\Games");
        if (gamesDir?.kind === "folder") {
          const folder: FSFolder = {
            id: "fs:games-jb", kind: "folder", name: "Jazzball",
            parentId: gamesDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
            system: false,
          };
          this.nodes.set(folder.id, folder);
          this.nodes.set("fs:games-jb-exe", {
            id: "fs:games-jb-exe", kind: "file", name: "Jazzball.exe",
            parentId: folder.id, createdAt: Date.now(), modifiedAt: Date.now(),
            fileType: "exe", content: "", mimeType: "application/octet-stream",
            system: false, readonly: false, appId: "jazzball",
          } as FSFile);
          jbDir = folder;
        }
      }
      if (jbDir?.kind === "folder") {
        this.nodes.set(JB_SCORES_ID, {
          id: JB_SCORES_ID, kind: "file", name: "SCORES.DAT",
          parentId: jbDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "dat", content: "", mimeType: "text/plain",
          system: false, readonly: false,
        } as FSFile);
        changed = true;
      }
    }

    // Ensure Brick Breaker folder + SCORES.DAT exist
    if (!this.nodes.has(BB_SCORES_ID)) {
      let bbDir = this.getNodeByPath("C:\\Programs\\Games\\Brick Breaker");
      if (!bbDir) {
        const gamesDir = this.getNodeByPath("C:\\Programs\\Games");
        if (gamesDir?.kind === "folder") {
          const folder: FSFolder = {
            id: "fs:games-bb", kind: "folder", name: "Brick Breaker",
            parentId: gamesDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
            system: false,
          };
          this.nodes.set(folder.id, folder);
          this.nodes.set("fs:games-bb-exe", {
            id: "fs:games-bb-exe", kind: "file", name: "Brick Breaker.exe",
            parentId: folder.id, createdAt: Date.now(), modifiedAt: Date.now(),
            fileType: "exe", content: "", mimeType: "application/octet-stream",
            system: false, readonly: false, appId: "brick-breaker",
          } as FSFile);
          bbDir = folder;
        }
      }
      if (bbDir?.kind === "folder") {
        this.nodes.set(BB_SCORES_ID, {
          id: BB_SCORES_ID, kind: "file", name: "SCORES.DAT",
          parentId: bbDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "dat", content: "", mimeType: "text/plain",
          system: false, readonly: false,
        } as FSFile);
        changed = true;
      }
    }

    // Ensure Jigsaw Puzzle folder + SCORES.DAT/SAVE.DAT/IMAGE.DAT exist
    if (!this.nodes.has(JP_SCORES_ID)) {
      let jpDir = this.getNodeByPath("C:\\Programs\\Games\\Jigsaw Puzzle");
      if (!jpDir) {
        const gamesDir = this.getNodeByPath("C:\\Programs\\Games");
        if (gamesDir?.kind === "folder") {
          const folder: FSFolder = {
            id: "fs:games-jp", kind: "folder", name: "Jigsaw Puzzle",
            parentId: gamesDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
            system: false,
          };
          this.nodes.set(folder.id, folder);
          this.nodes.set("fs:games-jp-exe", {
            id: "fs:games-jp-exe", kind: "file", name: "Jigsaw Puzzle.exe",
            parentId: folder.id, createdAt: Date.now(), modifiedAt: Date.now(),
            fileType: "exe", content: "", mimeType: "application/octet-stream",
            system: false, readonly: false, appId: "jigsaw-puzzle",
          } as FSFile);
          jpDir = folder;
        }
      }
      if (jpDir?.kind === "folder") {
        this.nodes.set(JP_SCORES_ID, {
          id: JP_SCORES_ID, kind: "file", name: "SCORES.DAT",
          parentId: jpDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "dat", content: "", mimeType: "text/plain",
          system: false, readonly: false,
        } as FSFile);
        changed = true;
      }
    }

    // Ensure Jigsaw Puzzle SAVE.DAT (in-progress game state) exists
    if (!this.nodes.has(JP_STATE_ID)) {
      const jpDir = this.getNodeByPath("C:\\Programs\\Games\\Jigsaw Puzzle");
      if (jpDir?.kind === "folder") {
        this.nodes.set(JP_STATE_ID, {
          id: JP_STATE_ID, kind: "file", name: "SAVE.DAT",
          parentId: jpDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "dat", content: "", mimeType: "text/plain",
          system: false, readonly: false,
        } as FSFile);
        changed = true;
      }
    }

    // Ensure Jigsaw Puzzle IMAGE.DAT (custom uploaded puzzle photo) exists
    if (!this.nodes.has(JP_IMAGE_ID)) {
      const jpDir = this.getNodeByPath("C:\\Programs\\Games\\Jigsaw Puzzle");
      if (jpDir?.kind === "folder") {
        this.nodes.set(JP_IMAGE_ID, {
          id: JP_IMAGE_ID, kind: "file", name: "IMAGE.DAT",
          parentId: jpDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "dat", content: "", mimeType: "text/plain",
          system: false, readonly: false,
        } as FSFile);
        changed = true;
      }
    }

    // Ensure Goober Dress-Up folder exists
    if (!this.nodes.has(GOOBER_FOLDER_ID)) {
      const gamesDir = this.getNodeByPath("C:\\Programs\\Games");
      if (gamesDir?.kind === "folder") {
        this.nodes.set(GOOBER_FOLDER_ID, {
          id: GOOBER_FOLDER_ID, kind: "folder", name: "Goober Dress-Up",
          parentId: gamesDir.id, createdAt: Date.now(), modifiedAt: Date.now(),
          system: false,
        } as FSFolder);
        this.nodes.set("fs:goober-exe", {
          id: "fs:goober-exe", kind: "file", name: "Goober Dress-Up.exe",
          parentId: GOOBER_FOLDER_ID, createdAt: Date.now(), modifiedAt: Date.now(),
          fileType: "exe", content: "", mimeType: "application/octet-stream",
          system: false, readonly: false, appId: "goober-dressup",
        } as FSFile);
        changed = true;
      }
    }

    // Ensure Goober Sprites subfolder exists
    if (!this.nodes.has(GOOBER_SPRITES_ID) && this.nodes.has(GOOBER_FOLDER_ID)) {
      this.nodes.set(GOOBER_SPRITES_ID, {
        id: GOOBER_SPRITES_ID, kind: "folder", name: "Sprites",
        parentId: GOOBER_FOLDER_ID, createdAt: Date.now(), modifiedAt: Date.now(),
        system: false,
      } as FSFolder);
      changed = true;
    }

    // Ensure per-frame sprite stubs exist (content filled by GooberDressup on first launch)
    if (this.nodes.has(GOOBER_SPRITES_ID)) {
      const GOOBER_SPRITE_FRAMES: Record<string, number> = {
        background: 6, bodyShape: 4, bodyOutfit: 5, ears: 5,
        noseWhiskers: 4, mouth: 5, eyes: 6, glasses: 5,
        necklace: 5, hat: 6, heldItem: 5,
      };
      for (const [key, count] of Object.entries(GOOBER_SPRITE_FRAMES)) {
        for (let i = 0; i < count; i++) {
          const id = `fs:goober-spr-${key}-${i}`;
          if (!this.nodes.has(id)) {
            this.nodes.set(id, {
              id, kind: "file", name: `${key}-${i}.png`,
              parentId: GOOBER_SPRITES_ID,
              createdAt: Date.now(), modifiedAt: Date.now(),
              fileType: "png", content: "", mimeType: "image/png",
              system: false, readonly: false, appId: "nsart",
            } as FSFile);
            changed = true;
          }
        }
      }
    }

    if (changed) this.save();
  }
}

export const fsStore = new FileSystemStore();
