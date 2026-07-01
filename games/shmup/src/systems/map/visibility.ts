/**
 * Adjacency fog (run-structure.spec.todo.md): "full info on adjacent,
 * partial further out (radar item reveals more)." Distance is BFS depth
 * forward from the currently-available nodes along the map's own edges.
 */
import type { NodeVisibility, SeasonMap } from "./types";

/** The nodes reachable right now: `startNodeIds` before any node is taken, else `next` of the current node. */
export function availableNodeIds(map: SeasonMap, currentNodeId: string | null): string[] {
  if (currentNodeId === null) return map.startNodeIds;
  return map.nodes[currentNodeId]?.next ?? [];
}

/**
 * Full info for available nodes (distance 0) and already-visited nodes,
 * partial info one hop further out, hidden beyond that.
 */
export function nodeVisibility(
  map: SeasonMap,
  currentNodeId: string | null,
  visitedNodeIds: readonly string[] = []
): Record<string, NodeVisibility> {
  const available = availableNodeIds(map, currentNodeId);
  const dist = new Map<string, number>();
  const queue: string[] = [];
  for (const id of available) {
    dist.set(id, 0);
    queue.push(id);
  }

  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const d = dist.get(id)!;
    if (d >= 2) continue; // only 0/1/2+ are distinguished — no need to walk further
    const node = map.nodes[id];
    if (!node) continue;
    for (const next of node.next) {
      if (!dist.has(next)) {
        dist.set(next, d + 1);
        queue.push(next);
      }
    }
  }

  const visited = new Set(visitedNodeIds);
  const result: Record<string, NodeVisibility> = {};
  for (const id of Object.keys(map.nodes)) {
    if (visited.has(id)) {
      result[id] = "full";
      continue;
    }
    const d = dist.get(id);
    result[id] = d === undefined ? "hidden" : d === 0 ? "full" : d === 1 ? "partial" : "hidden";
  }
  return result;
}
