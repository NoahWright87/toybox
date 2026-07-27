/**
 * Tag connectivity graph (specs/shmup-editor.todo.md) — answers "what does
 * my whole tile library's connectivity look like," as opposed to
 * ConnectionViewer's "does this one stack I built work." Nodes are edge
 * tags (not tiles); an edge between two tags exists if some tile has both
 * tags on it somewhere — literally "the edges of a tile become the edges
 * of the graph." Node size / edge thickness are the tag's / pair's raw
 * tile count, so common tags (and well-bridged biome pairs) read as
 * visually bigger/thicker, and rare ones as small outliers — the same
 * spirit as Chain Reaction's pairs.ts graph-health tooling, but visual
 * instead of a terminal report.
 */
import { HARDWALL, WILDCARD, slotTag, type TileDef } from "./types";

export interface TagNode {
  tag: string;
  /** Number of distinct tiles that use this tag on any edge. */
  count: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface TagEdge {
  a: string;
  b: string;
  /** Number of distinct tiles that carry both tags somewhere. */
  count: number;
}

export interface TagGraphData {
  nodes: TagNode[];
  edges: TagEdge[];
  /** tag -> index into `nodes`, built once per graph so callers never rebuild it per-frame/per-click. Stays valid across preservePositions() since that only mutates existing node entries, never reorders/replaces the array. */
  indexOf: Map<string, number>;
}

/** Every distinct real tag (hardwall/wildcard/blank excluded) a tile carries on any edge. */
function tileTags(tile: TileDef): Set<string> {
  const tags = new Set<string>();
  for (const slot of [...tile.north, ...tile.south, tile.east, tile.west]) {
    const tag = slotTag(slot);
    if (tag && tag !== HARDWALL && tag !== WILDCARD) tags.add(tag);
  }
  return tags;
}

/** Builds fresh graph data from the tile library. Every tile's distinct tags form a clique (each pair co-occurring on that tile increments one edge). */
export function buildTagGraph(tiles: TileDef[]): TagGraphData {
  const nodeCounts = new Map<string, number>();
  // Nested map (a -> b -> count) rather than a concatenated string key —
  // avoids inventing a separator character that could collide with a tag
  // name, or (as happened once here) an invisible one that's easy to
  // corrupt by accident.
  const edgeCounts = new Map<string, Map<string, number>>();

  for (const tile of tiles) {
    const tags = [...tileTags(tile)];
    for (const tag of tags) nodeCounts.set(tag, (nodeCounts.get(tag) ?? 0) + 1);
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const [a, b] = tags[i] < tags[j] ? [tags[i], tags[j]] : [tags[j], tags[i]];
        let inner = edgeCounts.get(a);
        if (!inner) {
          inner = new Map<string, number>();
          edgeCounts.set(a, inner);
        }
        inner.set(b, (inner.get(b) ?? 0) + 1);
      }
    }
  }

  const tagList = [...nodeCounts.keys()];
  const indexOf = new Map<string, number>(tagList.map((tag, i) => [tag, i]));
  const nodes: TagNode[] = tagList.map((tag, i) => {
    // Seed on a circle so the simulation isn't starting every node stacked
    // at one point (which never spreads out on its own).
    const angle = (i / Math.max(1, tagList.length)) * Math.PI * 2;
    return { tag, count: nodeCounts.get(tag)!, x: Math.cos(angle) * 120, y: Math.sin(angle) * 120, vx: 0, vy: 0 };
  });

  const edges: TagEdge[] = [];
  for (const [a, inner] of edgeCounts) {
    for (const [b, count] of inner) edges.push({ a, b, count });
  }

  return { nodes, edges, indexOf };
}

/** Carries over position/velocity for tags that exist in both the old and freshly-rebuilt graph, so the layout doesn't jump every time the library changes. */
export function preservePositions(next: TagGraphData, prev: TagGraphData): TagGraphData {
  const prevByTag = new Map<string, TagNode>(prev.nodes.map((n) => [n.tag, n]));
  for (const node of next.nodes) {
    const old = prevByTag.get(node.tag);
    if (old) {
      node.x = old.x;
      node.y = old.y;
      node.vx = old.vx;
      node.vy = old.vy;
    }
  }
  return next;
}

/** Tiles that use `tag` anywhere. */
export function tilesForTag(tiles: TileDef[], tag: string): TileDef[] {
  return tiles.filter((tile) => tileTags(tile).has(tag));
}

/** Tiles that carry BOTH tags somewhere — the tiles that "created" this graph edge. */
export function tilesForEdge(tiles: TileDef[], a: string, b: string): TileDef[] {
  return tiles.filter((tile) => {
    const tags = tileTags(tile);
    return tags.has(a) && tags.has(b);
  });
}

// ── Force-directed layout (Obsidian-graph-style: repel + spring + damping) ──

/** Coulomb-like repulsion between every pair of nodes — keeps unrelated tags from overlapping. Tuned empirically for a canvas a few hundred px across holding tens of nodes; retune if that scale changes a lot. */
const REPEL_STRENGTH = 2600;
/** Spring stiffness pulling connected tags together along an edge. */
const SPRING_STRENGTH = 0.02;
/** Per-tick velocity decay so the layout settles instead of oscillating forever. */
const DAMPING = 0.85;
/** Mild pull toward canvas center so the whole graph doesn't drift off-screen (no edges = no other force keeping nodes framed). */
const CENTER_STRENGTH = 0.015;
/** Floor on the distance used for spring force direction, so two nodes landing exactly on top of each other don't divide by ~0. */
const MIN_DISTANCE = 20;

/** More-connected pairs settle closer together, reinforcing clusters visually. */
function restLengthFor(edgeCount: number): number {
  return Math.max(50, 150 - edgeCount * 10);
}

/** Advances the simulation by one tick, mutating node positions/velocities in place. `pinnedTag` (if any) is excluded from physics — the caller is driving its position directly (e.g. a drag). */
export function stepSimulation(graph: TagGraphData, width: number, height: number, pinnedTag: string | null): void {
  const { nodes, edges, indexOf } = graph;
  if (nodes.length === 0) return;
  const cx = width / 2;
  const cy = height / 2;

  const fx = new Float64Array(nodes.length);
  const fy = new Float64Array(nodes.length);

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distSq = Math.max(1, dx * dx + dy * dy);
      const dist = Math.sqrt(distSq);
      const force = REPEL_STRENGTH / distSq;
      const nx = dx / dist;
      const ny = dy / dist;
      fx[i] += nx * force;
      fy[i] += ny * force;
      fx[j] -= nx * force;
      fy[j] -= ny * force;
    }
  }

  for (const edge of edges) {
    const i = indexOf.get(edge.a);
    const j = indexOf.get(edge.b);
    if (i === undefined || j === undefined) continue;
    const a = nodes[i];
    const b = nodes[j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(MIN_DISTANCE, Math.sqrt(dx * dx + dy * dy));
    const force = (dist - restLengthFor(edge.count)) * SPRING_STRENGTH;
    const nx = dx / dist;
    const ny = dy / dist;
    fx[i] += nx * force;
    fy[i] += ny * force;
    fx[j] -= nx * force;
    fy[j] -= ny * force;
  }

  for (let i = 0; i < nodes.length; i++) {
    fx[i] += (cx - nodes[i].x) * CENTER_STRENGTH;
    fy[i] += (cy - nodes[i].y) * CENTER_STRENGTH;
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.tag === pinnedTag) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.vx = (node.vx + fx[i]) * DAMPING;
    node.vy = (node.vy + fy[i]) * DAMPING;
    node.x += node.vx;
    node.y += node.vy;
  }
}
