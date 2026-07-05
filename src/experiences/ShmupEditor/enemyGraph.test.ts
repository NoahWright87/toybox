import { describe, it, expect } from "vitest";
import {
  addChildNode,
  addRootNode,
  deleteEdge,
  deleteNode,
  getChainOrder,
  getDescendantNodeIds,
  getLeafNodeIds,
  getUnreachableNodeIds,
  hasOutgoingEdge,
  isValidBranchTarget,
  moveNode,
  updateNode,
} from "./enemyGraph";
import { createBlankEnemy, defaultBranchCondition, type EnemyDef } from "./enemyTypes";

function enemy(): EnemyDef {
  return createBlankEnemy(0);
}

describe("addRootNode", () => {
  it("adds a single entrance node to a blank enemy", () => {
    const e = addRootNode(enemy(), { x: 5, y: 5 });
    expect(e.nodes).toHaveLength(1);
    expect(e.entranceNodeId).toBe(e.nodes[0].id);
    expect(e.edges).toHaveLength(0);
  });

  it("is a no-op once a root already exists", () => {
    const e1 = addRootNode(enemy(), { x: 0, y: 0 });
    const e2 = addRootNode(e1, { x: 99, y: 99 });
    expect(e2).toBe(e1);
  });
});

describe("addChildNode", () => {
  it("grows a new node off the entrance, linked by a default-movement edge", () => {
    const e1 = addRootNode(enemy());
    const e2 = addChildNode(e1, e1.nodes[0].id);
    expect(e2.nodes).toHaveLength(2);
    expect(e2.edges).toHaveLength(1);
    expect(e2.edges[0].fromNodeId).toBe(e1.nodes[0].id);
    expect(e2.edges[0].toNodeId).toBe(e2.nodes[1].id);
    expect(e2.edges[0].movement.kind).toBe("straightLine");
  });

  it("refuses to add a second outgoing edge off a node that already has one", () => {
    const e1 = addRootNode(enemy());
    const e2 = addChildNode(e1, e1.nodes[0].id);
    const e3 = addChildNode(e2, e1.nodes[0].id);
    expect(e3).toBe(e2);
    expect(e3.nodes).toHaveLength(2);
  });

  it("is a no-op for a nonexistent parent", () => {
    const e1 = addRootNode(enemy());
    const e2 = addChildNode(e1, "not-a-real-id");
    expect(e2).toBe(e1);
  });

  it("defaults the child's position to an offset from the parent when none is given", () => {
    const e1 = addRootNode(enemy(), { x: 10, y: 20 });
    const e2 = addChildNode(e1, e1.nodes[0].id);
    expect(e2.nodes[1].pos).not.toEqual(e1.nodes[0].pos);
  });
});

describe("hasOutgoingEdge / getLeafNodeIds", () => {
  it("identifies the single leaf of a 3-node chain", () => {
    let e = addRootNode(enemy());
    e = addChildNode(e, e.nodes[0].id);
    e = addChildNode(e, e.nodes[1].id);
    expect(hasOutgoingEdge(e, e.nodes[0].id)).toBe(true);
    expect(hasOutgoingEdge(e, e.nodes[2].id)).toBe(false);
    expect(getLeafNodeIds(e)).toEqual(new Set([e.nodes[2].id]));
  });

  it("treats a lone entrance node with no children as the (only) leaf", () => {
    const e = addRootNode(enemy());
    expect(getLeafNodeIds(e)).toEqual(new Set([e.nodes[0].id]));
  });
});

describe("getChainOrder", () => {
  it("returns nodes in entrance-to-tail order", () => {
    let e = addRootNode(enemy());
    e = addChildNode(e, e.nodes[0].id);
    e = addChildNode(e, e.nodes[1].id);
    expect(getChainOrder(e).map((n) => n.id)).toEqual(e.nodes.map((n) => n.id));
  });

  it("is empty for a brand new enemy with no entrance yet", () => {
    expect(getChainOrder(enemy())).toEqual([]);
  });
});

describe("getDescendantNodeIds", () => {
  it("includes the node itself plus everything downstream", () => {
    let e = addRootNode(enemy());
    e = addChildNode(e, e.nodes[0].id);
    e = addChildNode(e, e.nodes[1].id);
    const [root, mid, tail] = e.nodes;
    expect(getDescendantNodeIds(e, mid.id)).toEqual(new Set([mid.id, tail.id]));
    expect(getDescendantNodeIds(e, root.id)).toEqual(new Set([root.id, mid.id, tail.id]));
    expect(getDescendantNodeIds(e, tail.id)).toEqual(new Set([tail.id]));
  });
});

describe("deleteNode", () => {
  it("deleting a middle node removes it and everything downstream, leaving the parent as the new leaf", () => {
    let e = addRootNode(enemy());
    e = addChildNode(e, e.nodes[0].id);
    e = addChildNode(e, e.nodes[1].id);
    const [root, mid] = e.nodes;
    const afterDelete = deleteNode(e, mid.id);
    expect(afterDelete.nodes.map((n) => n.id)).toEqual([root.id]);
    expect(afterDelete.edges).toHaveLength(0);
    expect(getLeafNodeIds(afterDelete)).toEqual(new Set([root.id]));
  });

  it("deleting the entrance node clears the whole graph", () => {
    let e = addRootNode(enemy());
    e = addChildNode(e, e.nodes[0].id);
    const cleared = deleteNode(e, e.nodes[0].id);
    expect(cleared.entranceNodeId).toBeNull();
    expect(cleared.nodes).toEqual([]);
    expect(cleared.edges).toEqual([]);
  });

  it("clears a branch condition elsewhere in the graph that targeted a deleted node", () => {
    let e = addRootNode(enemy());
    e = addChildNode(e, e.nodes[0].id);
    e = addChildNode(e, e.nodes[1].id);
    const [root, mid, tail] = e.nodes;
    e = updateNode(e, root.id, { branch: defaultBranchCondition(tail.id) });
    expect(e.nodes.find((n) => n.id === root.id)?.branch?.targetNodeId).toBe(tail.id);

    const afterDelete = deleteNode(e, mid.id);
    expect(afterDelete.nodes.find((n) => n.id === root.id)?.branch).toBeNull();
  });

  it("is a no-op for a nonexistent node id", () => {
    const e = addRootNode(enemy());
    expect(deleteNode(e, "nope")).toBe(e);
  });
});

describe("deleteEdge", () => {
  it("deletes the edge's target node and its subtree", () => {
    let e = addRootNode(enemy());
    e = addChildNode(e, e.nodes[0].id);
    e = addChildNode(e, e.nodes[1].id);
    const edgeId = e.edges[0].id; // root -> mid
    const after = deleteEdge(e, edgeId);
    expect(after.nodes.map((n) => n.id)).toEqual([e.nodes[0].id]);
    expect(after.edges).toHaveLength(0);
  });
});

describe("getUnreachableNodeIds / isValidBranchTarget", () => {
  it("a fresh chain has no unreachable nodes", () => {
    let e = addRootNode(enemy());
    e = addChildNode(e, e.nodes[0].id);
    expect(getUnreachableNodeIds(e)).toEqual(new Set());
  });

  it("validates a branch target against the graph's actual node ids", () => {
    let e = addRootNode(enemy());
    e = addChildNode(e, e.nodes[0].id);
    expect(isValidBranchTarget(e, e.nodes[1].id)).toBe(true);
    expect(isValidBranchTarget(e, "not-real")).toBe(false);
  });
});

describe("moveNode", () => {
  it("updates only the target node's position", () => {
    let e = addRootNode(enemy(), { x: 0, y: 0 });
    e = addChildNode(e, e.nodes[0].id);
    const moved = moveNode(e, e.nodes[0].id, { x: 42, y: 7 });
    expect(moved.nodes[0].pos).toEqual({ x: 42, y: 7 });
    expect(moved.nodes[1].pos).toEqual(e.nodes[1].pos);
  });
});
