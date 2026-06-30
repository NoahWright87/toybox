import { describe, it, expect } from "vitest";
import {
  saveFileName,
  findChild,
  ensureSavesFolder,
  readSave,
  writeSave,
  removeSave,
  listSaves,
} from "./doorsFsSaveStore";

interface FsNodeLite {
  id: string;
  kind: "file" | "folder";
  name: string;
  parentId: string | null;
  content?: string;
  system?: boolean;
}

function nodes(...entries: FsNodeLite[]): Map<string, FsNodeLite> {
  return new Map(entries.map((n) => [n.id, n]));
}

describe("saveFileName", () => {
  it("uppercases the key and appends .DAT", () => {
    expect(saveFileName("career-checkpoint")).toBe("CAREER-CHECKPOINT.DAT");
  });
});

describe("ensureSavesFolder", () => {
  it("builds the full ROOT > Programs > Games > SHMUP > Saves chain from empty", () => {
    const tree = nodes();
    const savesId = ensureSavesFolder(tree);
    expect(savesId).toBe("fs:shmup-saves");
    expect(tree.get("fs:root")?.kind).toBe("folder");
    // Must match seed.ts's root node exactly (name "C:\\", system: true) so a
    // later Doors load doesn't find a malformed, unprotected root left behind
    // by SHMUP bootstrapping the FS blob first.
    expect(tree.get("fs:root")?.name).toBe("C:\\");
    expect(tree.get("fs:root")?.system).toBe(true);
    expect(tree.get("fs:programs")?.parentId).toBe("fs:root");
    expect(tree.get("fs:games")?.parentId).toBe("fs:programs");
    expect(tree.get("fs:shmup")?.parentId).toBe("fs:games");
    expect(tree.get("fs:shmup-saves")?.parentId).toBe("fs:shmup");
  });

  it("does not overwrite nodes that already exist (idempotent against a real Doors-seeded tree)", () => {
    const tree = nodes(
      { id: "fs:root", kind: "folder", name: "C:", parentId: null },
      { id: "fs:programs", kind: "folder", name: "Programs", parentId: "fs:root" },
      { id: "fs:games", kind: "folder", name: "Games", parentId: "fs:programs" },
      { id: "fs:shmup", kind: "folder", name: "SHMUP", parentId: "fs:games" }
    );
    ensureSavesFolder(tree);
    // Pre-existing nodes keep their identity (same object reference = untouched)
    expect(tree.get("fs:shmup")?.name).toBe("SHMUP");
    expect(tree.size).toBe(5);
  });
});

describe("write/read/remove/list round trip", () => {
  it("writes a save into a freshly-bootstrapped tree and reads it back", () => {
    const tree = nodes();
    writeSave(tree, "settings", '{"sound":true}');
    expect(readSave(tree, "settings")).toBe('{"sound":true}');
  });

  it("returns null reading a key that was never written", () => {
    const tree = nodes();
    expect(readSave(tree, "nope")).toBeNull();
  });

  it("read does not mutate the tree (no folder bootstrap on a pure read)", () => {
    const tree = nodes();
    readSave(tree, "settings");
    expect(tree.size).toBe(0);
  });

  it("overwrites an existing save in place rather than creating a duplicate file", () => {
    const tree = nodes();
    writeSave(tree, "settings", "v1");
    writeSave(tree, "settings", "v2");
    expect(readSave(tree, "settings")).toBe("v2");
    const savesChildren = [...tree.values()].filter((n) => n.parentId === "fs:shmup-saves");
    expect(savesChildren).toHaveLength(1);
  });

  it("round-trips through JSON serialization, mirroring a localStorage blob reload", () => {
    const tree = nodes();
    writeSave(tree, "career", '{"season":3}');
    const serialized = JSON.stringify([...tree.entries()]);
    const reloaded = new Map(JSON.parse(serialized));
    expect(readSave(reloaded as Map<string, FsNodeLite>, "career")).toBe('{"season":3}');
  });

  it("removes a save so a later read returns null", () => {
    const tree = nodes();
    writeSave(tree, "settings", "v1");
    removeSave(tree, "settings");
    expect(readSave(tree, "settings")).toBeNull();
  });

  it("remove on a key that was never written is a no-op", () => {
    const tree = nodes();
    expect(() => removeSave(tree, "nope")).not.toThrow();
  });

  it("lists keys by prefix, case-insensitively, stripping the .DAT extension", () => {
    const tree = nodes();
    writeSave(tree, "slot-1", "a");
    writeSave(tree, "slot-2", "b");
    writeSave(tree, "settings", "c");
    expect(listSaves(tree, "slot-").sort()).toEqual(["slot-1", "slot-2"]);
    expect(listSaves(tree, "SLOT-").sort()).toEqual(["slot-1", "slot-2"]);
    expect(listSaves(tree, "")).toHaveLength(3);
  });

  it("list on a tree with no Saves folder yet returns an empty array", () => {
    expect(listSaves(nodes(), "")).toEqual([]);
  });
});

describe("findChild", () => {
  it("is case-insensitive", () => {
    const tree = nodes({ id: "fs:a", kind: "file", name: "SETTINGS.DAT", parentId: "fs:shmup-saves" });
    expect(findChild(tree, "fs:shmup-saves", "settings.dat")?.id).toBe("fs:a");
  });
});
