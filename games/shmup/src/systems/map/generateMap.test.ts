import { describe, it, expect } from "vitest";
import { generateSeasonMap } from "./generateMap";
import { TUNING } from "../../tuning";

describe("generateSeasonMap", () => {
  it("is deterministic: same season/ratingsRank/seed always produces the same map", () => {
    const a = generateSeasonMap(1, 2, 12345);
    const b = generateSeasonMap(1, 2, 12345);
    expect(a).toEqual(b);
  });

  it("different seeds produce different maps", () => {
    const a = generateSeasonMap(1, 2, 1);
    const b = generateSeasonMap(1, 2, 2);
    expect(a).not.toEqual(b);
  });

  it("has columnsPerSeason regular columns plus one boss column", () => {
    const map = generateSeasonMap(1, 0, 42);
    const maxCol = Math.max(...Object.values(map.nodes).map((n) => n.col));
    expect(maxCol).toBe(TUNING.map.columnsPerSeason);
    expect(map.nodes[map.bossNodeId].col).toBe(TUNING.map.columnsPerSeason);
    expect(map.nodes[map.bossNodeId].type).toBe("bossFinale");
  });

  it("every node has at least one incoming edge from the previous column (no orphans)", () => {
    const map = generateSeasonMap(2, 3, 999);
    for (const node of Object.values(map.nodes)) {
      if (node.col === 0) continue; // column 0 is reachable from the Season start, not another node
      const hasIncoming = Object.values(map.nodes).some((n) => n.next.includes(node.id));
      expect(hasIncoming).toBe(true);
    }
  });

  it("startNodeIds are exactly column 0's nodes", () => {
    const map = generateSeasonMap(1, 1, 7);
    const col0Ids = Object.values(map.nodes)
      .filter((n) => n.col === 0)
      .map((n) => n.id);
    expect(new Set(map.startNodeIds)).toEqual(new Set(col0Ids));
  });

  it("the last regular column funnels entirely into the boss node", () => {
    const map = generateSeasonMap(1, 1, 55);
    const lastCol = TUNING.map.columnsPerSeason - 1;
    for (const node of Object.values(map.nodes)) {
      if (node.col === lastCol) expect(node.next).toEqual([map.bossNodeId]);
    }
  });

  it("higher Ratings rank never produces fewer total nodes on average (more node options)", () => {
    let lowTotal = 0;
    let highTotal = 0;
    for (let seed = 0; seed < 30; seed++) {
      lowTotal += Object.keys(generateSeasonMap(1, 0, seed).nodes).length;
      highTotal += Object.keys(generateSeasonMap(1, 7, seed).nodes).length;
    }
    expect(highTotal).toBeGreaterThan(lowTotal);
  });

  it("higher Ratings rank skews toward special node types, not toward Difficulty", () => {
    let lowSpecial = 0;
    let highSpecial = 0;
    let lowTotal = 0;
    let highTotal = 0;
    const isSpecial = (t: string) => t === "shop" || t === "event" || t === "treasure";
    for (let seed = 0; seed < 40; seed++) {
      const low = Object.values(generateSeasonMap(1, 0, seed).nodes).filter((n) => n.col < TUNING.map.columnsPerSeason);
      const high = Object.values(generateSeasonMap(1, 7, seed).nodes).filter((n) => n.col < TUNING.map.columnsPerSeason);
      lowSpecial += low.filter((n) => isSpecial(n.type)).length;
      highSpecial += high.filter((n) => isSpecial(n.type)).length;
      lowTotal += low.length;
      highTotal += high.length;
    }
    expect(highSpecial / highTotal).toBeGreaterThan(lowSpecial / lowTotal);
  });
});
