/**
 * Deterministic Season map generator (run-structure.spec.todo.md, F8 #136).
 * Ratings gates node COUNT and the special-node skew here — Difficulty (D)
 * never enters this file; only `difficultyOffset` (a flat D nudge consumed
 * later by systems/difficulty) is authored per node type.
 */
import { TUNING } from "../../tuning";
import { mulberry32, randInt, type Rng } from "./rng";
import type { MapNode, NodeType, SeasonMap, SpecialNodeType } from "./types";
import { SPECIAL_NODE_TYPES } from "./types";

function difficultyOffsetFor(type: NodeType): number {
  switch (type) {
    case "shop":
      return TUNING.map.shopDifficultyOffset;
    case "event":
      return TUNING.map.eventDifficultyOffset;
    case "treasure":
      return TUNING.map.treasureDifficultyOffset;
    case "elite":
      return TUNING.map.eliteDifficultyOffset;
    default:
      return 0;
  }
}

/** Rolls one node's type: special-node odds rise with Ratings rank, elite odds are flat. */
function rollNodeType(rng: Rng, ratingsRank: number): NodeType {
  const pSpecial = Math.min(
    TUNING.map.specialNodeChanceMax,
    TUNING.map.specialNodeBaseChance + TUNING.map.specialNodeChancePerRatingsRank * ratingsRank
  );
  const pElite = TUNING.map.eliteNodeChance * (1 - pSpecial);

  const roll = rng();
  if (roll < pSpecial) {
    const specials: readonly SpecialNodeType[] = SPECIAL_NODE_TYPES;
    return specials[Math.floor((roll / pSpecial) * specials.length) % specials.length];
  }
  if (roll < pSpecial + pElite) return "elite";
  return "standard";
}

function nodeCountForColumn(rng: Rng, ratingsRank: number): number {
  const base = randInt(rng, TUNING.map.nodesPerColumnMin, TUNING.map.nodesPerColumnMax);
  let extra = 0;
  for (let r = 0; r < ratingsRank; r++) {
    if (rng() < TUNING.map.extraNodeChancePerRatingsRank) extra++;
  }
  return base + Math.min(3, extra);
}

/**
 * Builds a Season's DAG: `columnsPerSeason` regular columns feeding into a
 * single boss column. Every node in column c+1 is guaranteed at least one
 * incoming edge from column c (no unreachable nodes); the last regular
 * column funnels entirely into the boss.
 */
export function generateSeasonMap(season: number, ratingsRank: number, seed: number): SeasonMap {
  const rng = mulberry32(seed);
  const columns = TUNING.map.columnsPerSeason;
  const nodes: Record<string, MapNode> = {};
  const columnNodeIds: string[][] = [];

  for (let col = 0; col < columns; col++) {
    const count = nodeCountForColumn(rng, ratingsRank);
    const ids: string[] = [];
    for (let row = 0; row < count; row++) {
      const type = rollNodeType(rng, ratingsRank);
      const id = `s${season}-c${col}-n${row}`;
      nodes[id] = { id, type, col, row, next: [], difficultyOffset: difficultyOffsetFor(type) };
      ids.push(id);
    }
    columnNodeIds.push(ids);
  }

  const bossNodeId = `s${season}-boss`;
  nodes[bossNodeId] = {
    id: bossNodeId,
    type: "bossFinale",
    col: columns,
    row: 0,
    next: [],
    difficultyOffset: 0,
  };

  for (let col = 0; col < columns - 1; col++) {
    const from = columnNodeIds[col];
    const to = columnNodeIds[col + 1];
    for (const fromId of from) {
      const linkCount = Math.min(to.length, randInt(rng, 1, 2));
      const chosen = new Set<string>();
      while (chosen.size < linkCount) {
        chosen.add(to[randInt(rng, 0, to.length - 1)]);
      }
      nodes[fromId].next = [...chosen];
    }
    // Guarantee every node in the next column is reachable from this one.
    for (const toId of to) {
      const hasIncoming = from.some((fromId) => nodes[fromId].next.includes(toId));
      if (!hasIncoming) {
        const fromId = from[randInt(rng, 0, from.length - 1)];
        nodes[fromId].next.push(toId);
      }
    }
  }

  const lastColumn = columnNodeIds[columns - 1];
  for (const id of lastColumn) {
    nodes[id].next = [bossNodeId];
  }

  return {
    season,
    seed,
    columns,
    nodes,
    startNodeIds: columnNodeIds[0],
    bossNodeId,
  };
}
