import { describe, it, expect } from "vitest";
import { resolveFsOverride, spriteOverridePath, SHMUP_SPRITES_FS_DIR } from "./fsOverride";

interface FsNodeLite {
  id: string;
  kind: "file" | "folder" | "shortcut";
  name: string;
  parentId: string | null;
  content?: string;
}

function nodes(...entries: FsNodeLite[]): Map<string, FsNodeLite> {
  return new Map(entries.map((n) => [n.id, n]));
}

describe("spriteOverridePath", () => {
  it("maps a manifest-relative path under the SHMUP Sprites FS folder", () => {
    expect(spriteOverridePath("ships/ship_player_idle_01.png")).toBe(
      SHMUP_SPRITES_FS_DIR + "ships\\ship_player_idle_01.png"
    );
  });
});

describe("resolveFsOverride", () => {
  const tree = nodes(
    { id: "fs:root", kind: "folder", name: "C:", parentId: null },
    { id: "fs:programs", kind: "folder", name: "Programs", parentId: "fs:root" },
    { id: "fs:games", kind: "folder", name: "Games", parentId: "fs:programs" },
    { id: "fs:shmup", kind: "folder", name: "SHMUP", parentId: "fs:games" },
    { id: "fs:sprites", kind: "folder", name: "Sprites", parentId: "fs:shmup" },
    { id: "fs:ships", kind: "folder", name: "ships", parentId: "fs:sprites" },
    {
      id: "fs:ship-png",
      kind: "file",
      name: "ship_player_idle_01.png",
      parentId: "fs:ships",
      content: "data:image/png;base64,AAAA",
    },
    {
      id: "fs:empty-png",
      kind: "file",
      name: "empty.png",
      parentId: "fs:ships",
      content: "",
    }
  );

  it("returns the file content when a non-empty override exists", () => {
    const url = resolveFsOverride(
      tree,
      "C:\\Programs\\Games\\SHMUP\\Sprites\\ships\\ship_player_idle_01.png"
    );
    expect(url).toBe("data:image/png;base64,AAAA");
  });

  it("is case-insensitive on path segments", () => {
    const url = resolveFsOverride(
      tree,
      "C:\\PROGRAMS\\games\\Shmup\\sprites\\SHIPS\\Ship_Player_Idle_01.PNG"
    );
    expect(url).toBe("data:image/png;base64,AAAA");
  });

  it("returns undefined when the file exists but is empty", () => {
    expect(
      resolveFsOverride(tree, "C:\\Programs\\Games\\SHMUP\\Sprites\\ships\\empty.png")
    ).toBeUndefined();
  });

  it("returns undefined when no node matches the path", () => {
    expect(
      resolveFsOverride(tree, "C:\\Programs\\Games\\SHMUP\\Sprites\\ships\\nope.png")
    ).toBeUndefined();
  });
});
