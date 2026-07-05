/**
 * Pure graph-CRUD logic for the enemy node graph (specs/shmup-editor.todo.md,
 * E2 #192) — the free-form-canvas analogue of connectionGrid.ts's placement
 * math. Kept independent of any rendering/React code so it can be unit
 * tested directly, the same way connectionGrid.test.ts was written before
 * ConnectionViewer.tsx.
 *
 * The graph is a strict CHAIN (see enemyTypes.ts's file comment): every node
 * has at most one outgoing edge, built by "growing" a node off an existing
 * one. There is no free "connect any two existing nodes" operation, so the
 * only structural mutations are: add a node (root or child), move a node,
 * and delete a node (which cascades to everything downstream of it, since
 * there's no UI gesture to re-attach an orphaned subtree afterward).
 */
import {
  makeEdgeId,
  makeNodeId,
  defaultMovement,
  type EnemyDef,
  type GraphEdge,
  type GraphNode,
  type Vec2,
} from "./enemyTypes";

const DEFAULT_CHILD_OFFSET: Vec2 = { x: 130, y: 0 };

function blankNode(pos: Vec2): GraphNode {
  return { id: makeNodeId(), pos, dwell: null, attack: null, branch: null, exit: null, entranceAppearance: null };
}

/** Adds the very first node (the entrance). No-op (returns enemy unchanged) if a root already exists. */
export function addRootNode(enemy: EnemyDef, pos: Vec2 = { x: 0, y: 0 }): EnemyDef {
  if (enemy.entranceNodeId) return enemy;
  const node = blankNode(pos);
  return { ...enemy, entranceNodeId: node.id, nodes: [node], edges: [] };
}

/** True if `nodeId` already has an outgoing edge (a chain node can have at most one). */
export function hasOutgoingEdge(enemy: EnemyDef, nodeId: string): boolean {
  return enemy.edges.some((e) => e.fromNodeId === nodeId);
}

/** Grows a new node off `parentNodeId`, linked by a fresh edge with a default straightLine movement. No-op if the parent doesn't exist or already has an outgoing edge (one primary edge per node, by design — see enemyTypes.ts). */
export function addChildNode(enemy: EnemyDef, parentNodeId: string, pos?: Vec2): EnemyDef {
  const parent = enemy.nodes.find((n) => n.id === parentNodeId);
  if (!parent) return enemy;
  if (hasOutgoingEdge(enemy, parentNodeId)) return enemy;

  const childPos = pos ?? { x: parent.pos.x + DEFAULT_CHILD_OFFSET.x, y: parent.pos.y + DEFAULT_CHILD_OFFSET.y };
  const node = blankNode(childPos);
  const edge: GraphEdge = { id: makeEdgeId(), fromNodeId: parentNodeId, toNodeId: node.id, movement: defaultMovement(), attack: null, branch: null };
  return { ...enemy, nodes: [...enemy.nodes, node], edges: [...enemy.edges, edge] };
}

export function moveNode(enemy: EnemyDef, nodeId: string, pos: Vec2): EnemyDef {
  return { ...enemy, nodes: enemy.nodes.map((n) => (n.id === nodeId ? { ...n, pos } : n)) };
}

export function updateNode(enemy: EnemyDef, nodeId: string, patch: Partial<GraphNode>): EnemyDef {
  return { ...enemy, nodes: enemy.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) };
}

export function updateEdge(enemy: EnemyDef, edgeId: string, patch: Partial<GraphEdge>): EnemyDef {
  return { ...enemy, edges: enemy.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)) };
}

export function getOutgoingEdge(enemy: EnemyDef, nodeId: string): GraphEdge | undefined {
  return enemy.edges.find((e) => e.fromNodeId === nodeId);
}

export function getIncomingEdge(enemy: EnemyDef, nodeId: string): GraphEdge | undefined {
  return enemy.edges.find((e) => e.toNodeId === nodeId);
}

/** Nodes with no outgoing edge — the only nodes an ExitConfig is meaningful on. */
export function getLeafNodeIds(enemy: EnemyDef): Set<string> {
  const withOutgoing = new Set(enemy.edges.map((e) => e.fromNodeId));
  return new Set(enemy.nodes.filter((n) => !withOutgoing.has(n.id)).map((n) => n.id));
}

/** `nodeId` plus every node transitively reachable via outgoing edges (the subtree a delete would remove). */
export function getDescendantNodeIds(enemy: EnemyDef, nodeId: string): Set<string> {
  const out = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of enemy.edges) {
      if (edge.fromNodeId === current && !out.has(edge.toNodeId)) {
        out.add(edge.toNodeId);
        queue.push(edge.toNodeId);
      }
    }
  }
  return out;
}

/** The chain in order, starting at the entrance node and following outgoing edges. Nodes unreachable from the entrance (e.g. only reachable via a branch jump) are NOT included — see getUnreachableNodeIds. */
export function getChainOrder(enemy: EnemyDef): GraphNode[] {
  if (!enemy.entranceNodeId) return [];
  const order: GraphNode[] = [];
  const seen = new Set<string>();
  let currentId: string | undefined = enemy.entranceNodeId;
  while (currentId && !seen.has(currentId)) {
    const node = enemy.nodes.find((n) => n.id === currentId);
    if (!node) break;
    order.push(node);
    seen.add(currentId);
    currentId = getOutgoingEdge(enemy, currentId)?.toNodeId;
  }
  return order;
}

/** Nodes not reachable by following the chain from the entrance — only reachable (if at all) via some branch jump. Not an error, just informational (this tool visually-checks rather than hard-blocks, per shmup-editor.md's E1 philosophy). */
export function getUnreachableNodeIds(enemy: EnemyDef): Set<string> {
  const reachable = new Set(getChainOrder(enemy).map((n) => n.id));
  return new Set(enemy.nodes.filter((n) => !reachable.has(n.id)).map((n) => n.id));
}

export function isValidBranchTarget(enemy: EnemyDef, nodeId: string): boolean {
  return enemy.nodes.some((n) => n.id === nodeId);
}

/** A short human label for a node — "Node 2 (entrance)", "Node 4 (leaf)" — used by branch-condition target dropdowns. */
export function nodeLabel(enemy: EnemyDef, nodeId: string): string {
  const idx = enemy.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return "?";
  const tags: string[] = [];
  if (enemy.entranceNodeId === nodeId) tags.push("entrance");
  if (!hasOutgoingEdge(enemy, nodeId)) tags.push("leaf");
  return `Node ${idx + 1}${tags.length ? ` (${tags.join(", ")})` : ""}`;
}

export function getNodeOptions(enemy: EnemyDef): { id: string; label: string }[] {
  return enemy.nodes.map((n) => ({ id: n.id, label: nodeLabel(enemy, n.id) }));
}

/** Clears any branch condition (on a node or edge) whose targetNodeId is no longer in the graph. */
function clearDanglingBranches(enemy: EnemyDef): EnemyDef {
  const validIds = new Set(enemy.nodes.map((n) => n.id));
  return {
    ...enemy,
    nodes: enemy.nodes.map((n) => (n.branch && !validIds.has(n.branch.targetNodeId) ? { ...n, branch: null } : n)),
    edges: enemy.edges.map((e) => (e.branch && !validIds.has(e.branch.targetNodeId) ? { ...e, branch: null } : e)),
  };
}

/**
 * Deletes `nodeId` and its entire downstream subtree (everything reachable
 * via outgoing edges) — there's no canvas gesture to re-attach an orphaned
 * subtree afterward, so a partial delete would just leave dead nodes with
 * no way to reconnect them. Deleting the entrance node clears the whole
 * graph. Any branch condition elsewhere in the graph that targeted a
 * removed node is cleared rather than left dangling.
 */
export function deleteNode(enemy: EnemyDef, nodeId: string): EnemyDef {
  if (!enemy.nodes.some((n) => n.id === nodeId)) return enemy;

  if (nodeId === enemy.entranceNodeId) {
    return { ...enemy, entranceNodeId: null, nodes: [], edges: [] };
  }

  const toRemove = getDescendantNodeIds(enemy, nodeId);
  const nodes = enemy.nodes.filter((n) => !toRemove.has(n.id));
  const edges = enemy.edges.filter((e) => !toRemove.has(e.fromNodeId) && !toRemove.has(e.toNodeId));
  return clearDanglingBranches({ ...enemy, nodes, edges });
}

/** Deletes an edge by deleting its target node (and that node's subtree) — see deleteNode's doc comment for why a partial detach isn't offered. */
export function deleteEdge(enemy: EnemyDef, edgeId: string): EnemyDef {
  const edge = enemy.edges.find((e) => e.id === edgeId);
  if (!edge) return enemy;
  return deleteNode(enemy, edge.toNodeId);
}
