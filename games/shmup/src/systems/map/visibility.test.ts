import { describe, it, expect } from "vitest";
import { generateSeasonMap } from "./generateMap";
import { nodeVisibility, availableNodeIds } from "./visibility";

describe("availableNodeIds", () => {
  it("returns the Season's startNodeIds when no node has been taken yet", () => {
    const map = generateSeasonMap(1, 0, 1);
    expect(availableNodeIds(map, null)).toEqual(map.startNodeIds);
  });

  it("returns the current node's `next` list once a node has been taken", () => {
    const map = generateSeasonMap(1, 0, 1);
    const first = map.startNodeIds[0];
    expect(availableNodeIds(map, first)).toEqual(map.nodes[first].next);
  });
});

describe("nodeVisibility", () => {
  it("marks the available nodes as full and everything unreachable-from-them as hidden or partial", () => {
    const map = generateSeasonMap(1, 0, 1);
    const vis = nodeVisibility(map, null);
    for (const id of map.startNodeIds) expect(vis[id]).toBe("full");
  });

  it("marks one hop beyond available as partial", () => {
    const map = generateSeasonMap(1, 0, 1);
    const vis = nodeVisibility(map, null);
    const oneHop = new Set(map.startNodeIds.flatMap((id) => map.nodes[id].next));
    for (const id of oneHop) {
      if (!map.startNodeIds.includes(id)) expect(vis[id]).toBe("partial");
    }
  });

  it("marks already-visited nodes as full even if they're behind the current position", () => {
    const map = generateSeasonMap(1, 0, 1);
    const first = map.startNodeIds[0];
    const vis = nodeVisibility(map, first, [first]);
    expect(vis[first]).toBe("full");
  });

  it("marks far-away nodes as hidden", () => {
    const map = generateSeasonMap(1, 0, 1);
    const vis = nodeVisibility(map, null);
    expect(vis[map.bossNodeId]).toBe("hidden");
  });
});
