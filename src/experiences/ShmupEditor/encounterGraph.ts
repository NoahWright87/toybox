/**
 * Pure graph-CRUD logic for one enemy instance's behavior graph within an
 * encounter (specs/shmup-editor.todo.md, E2 #192) — the free-form-canvas
 * analogue of connectionGrid.ts's placement math. Kept independent of any
 * rendering/React code so it can be unit tested directly, the same way
 * connectionGrid.test.ts was written before ConnectionViewer.tsx.
 *
 * The graph is a strict CHAIN (see encounterTypes.ts's file comment):
 * every node has at most one outgoing edge, built by "growing" a node off
 * an existing one. There is no free "connect any two existing nodes"
 * operation and no branch-condition escape hatch (cut after the first
 * pass at this system, see encounterTypes.ts), so the only structural
 * mutations are: add a node (root or child), move a node, and delete a
 * node (which cascades to everything downstream of it, since there's no
 * UI gesture to re-attach an orphaned subtree afterward).
 */
import { makeEdgeId, makeNodeId, defaultMovement, type EncounterEnemy, type GraphEdge, type GraphNode, type Vec2 } from "./encounterTypes";

const DEFAULT_CHILD_OFFSET: Vec2 = { x: 130, y: 0 };

function blankNode(pos: Vec2): GraphNode {
  return { id: makeNodeId(), pos, dwell: null, attack: null, exit: null, entranceAppearance: null };
}

/** Adds the very first node (the entrance). No-op (returns the instance unchanged) if a root already exists. */
export function addRootNode(instance: EncounterEnemy, pos: Vec2 = { x: 0, y: 0 }): EncounterEnemy {
  if (instance.entranceNodeId) return instance;
  const node = blankNode(pos);
  return { ...instance, entranceNodeId: node.id, nodes: [node], edges: [] };
}

/** True if `nodeId` already has an outgoing edge (a chain node can have at most one). */
export function hasOutgoingEdge(instance: EncounterEnemy, nodeId: string): boolean {
  return instance.edges.some((e) => e.fromNodeId === nodeId);
}

/** Grows a new node off `parentNodeId`, linked by a fresh edge with a default straightLine movement. No-op if the parent doesn't exist or already has an outgoing edge (one primary edge per node, by design — see encounterTypes.ts). */
export function addChildNode(instance: EncounterEnemy, parentNodeId: string, pos?: Vec2): EncounterEnemy {
  const parent = instance.nodes.find((n) => n.id === parentNodeId);
  if (!parent) return instance;
  if (hasOutgoingEdge(instance, parentNodeId)) return instance;

  const childPos = pos ?? { x: parent.pos.x + DEFAULT_CHILD_OFFSET.x, y: parent.pos.y + DEFAULT_CHILD_OFFSET.y };
  const node = blankNode(childPos);
  const edge: GraphEdge = { id: makeEdgeId(), fromNodeId: parentNodeId, toNodeId: node.id, movement: defaultMovement(), attack: null };
  return { ...instance, nodes: [...instance.nodes, node], edges: [...instance.edges, edge] };
}

export function moveNode(instance: EncounterEnemy, nodeId: string, pos: Vec2): EncounterEnemy {
  return { ...instance, nodes: instance.nodes.map((n) => (n.id === nodeId ? { ...n, pos } : n)) };
}

export function updateNode(instance: EncounterEnemy, nodeId: string, patch: Partial<GraphNode>): EncounterEnemy {
  return { ...instance, nodes: instance.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) };
}

export function updateEdge(instance: EncounterEnemy, edgeId: string, patch: Partial<GraphEdge>): EncounterEnemy {
  return { ...instance, edges: instance.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)) };
}

export function getOutgoingEdge(instance: EncounterEnemy, nodeId: string): GraphEdge | undefined {
  return instance.edges.find((e) => e.fromNodeId === nodeId);
}

export function getIncomingEdge(instance: EncounterEnemy, nodeId: string): GraphEdge | undefined {
  return instance.edges.find((e) => e.toNodeId === nodeId);
}

/** Nodes with no outgoing edge — the only nodes an ExitConfig is meaningful on. */
export function getLeafNodeIds(instance: EncounterEnemy): Set<string> {
  const withOutgoing = new Set(instance.edges.map((e) => e.fromNodeId));
  return new Set(instance.nodes.filter((n) => !withOutgoing.has(n.id)).map((n) => n.id));
}

/** `nodeId` plus every node transitively reachable via outgoing edges (the subtree a delete would remove). */
export function getDescendantNodeIds(instance: EncounterEnemy, nodeId: string): Set<string> {
  const out = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of instance.edges) {
      if (edge.fromNodeId === current && !out.has(edge.toNodeId)) {
        out.add(edge.toNodeId);
        queue.push(edge.toNodeId);
      }
    }
  }
  return out;
}

/** The chain in order, starting at the entrance node and following outgoing edges. */
export function getChainOrder(instance: EncounterEnemy): GraphNode[] {
  if (!instance.entranceNodeId) return [];
  const order: GraphNode[] = [];
  const seen = new Set<string>();
  let currentId: string | undefined = instance.entranceNodeId;
  while (currentId && !seen.has(currentId)) {
    const node = instance.nodes.find((n) => n.id === currentId);
    if (!node) break;
    order.push(node);
    seen.add(currentId);
    currentId = getOutgoingEdge(instance, currentId)?.toNodeId;
  }
  return order;
}

/**
 * Deletes `nodeId` and its entire downstream subtree (everything reachable
 * via outgoing edges) — there's no canvas gesture to re-attach an orphaned
 * subtree afterward, so a partial delete would just leave dead nodes with
 * no way to reconnect them. Deleting the entrance node clears the whole
 * instance's graph.
 */
export function deleteNode(instance: EncounterEnemy, nodeId: string): EncounterEnemy {
  if (!instance.nodes.some((n) => n.id === nodeId)) return instance;

  if (nodeId === instance.entranceNodeId) {
    return { ...instance, entranceNodeId: null, nodes: [], edges: [] };
  }

  const toRemove = getDescendantNodeIds(instance, nodeId);
  const nodes = instance.nodes.filter((n) => !toRemove.has(n.id));
  const edges = instance.edges.filter((e) => !toRemove.has(e.fromNodeId) && !toRemove.has(e.toNodeId));
  return { ...instance, nodes, edges };
}

/** Deletes an edge by deleting its target node (and that node's subtree) — see deleteNode's doc comment for why a partial detach isn't offered. */
export function deleteEdge(instance: EncounterEnemy, edgeId: string): EncounterEnemy {
  const edge = instance.edges.find((e) => e.id === edgeId);
  if (!edge) return instance;
  return deleteNode(instance, edge.toNodeId);
}
