/**
 * Data shapes for the Season node-map (run-structure.spec.todo.md, F8 #136).
 * Pure types only; behavior lives in the sibling modules.
 */

export const NODE_TYPES = ["standard", "elite", "shop", "event", "treasure", "bossFinale"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/** Special (non-combat) node types resolve instantly on the map, no episode launch. */
export const SPECIAL_NODE_TYPES = ["shop", "event", "treasure"] as const;
export type SpecialNodeType = (typeof SPECIAL_NODE_TYPES)[number];

export interface MapNode {
  id: string;
  type: NodeType;
  /** Column index (0-based); the boss node sits alone in the final column. */
  col: number;
  /** Lane position within its column, purely for layout. */
  row: number;
  /** Ids of nodes in column+1 this node connects to. Empty for the boss node. */
  next: string[];
  /** Flat D offset applied when this node is entered (run-structure.spec.todo.md: "special nodes may carry a negative D offset"). */
  difficultyOffset: number;
}

export interface SeasonMap {
  season: number;
  seed: number;
  columns: number;
  nodes: Record<string, MapNode>;
  /** Nodes in column 0 — reachable from the Season's virtual start. */
  startNodeIds: string[];
  bossNodeId: string;
}

/** Per-node fog-of-war state, derived from the player's current position. */
export type NodeVisibility = "full" | "partial" | "hidden";
