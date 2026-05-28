import {
  type FSNode, type FSFile, type FSFolder, type FSShortcut, type FSFileType,
  ROOT_ID, DUMPSTER_ID, NS_ART_BACKUP_ID,
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
        const file: FSFile = {
          id: NS_ART_BACKUP_ID,
          kind: "file",
          name: "Untitled.nsart",
          parentId: nsArtDir.id,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          fileType: "dat",
          content: "",
          mimeType: "application/json",
          system: false,
          readonly: false,
          appId: "nsart",
        };
        this.nodes.set(NS_ART_BACKUP_ID, file);
        changed = true;
      }
    }

    if (changed) this.save();
  }
}

export const fsStore = new FileSystemStore();
