import { describe, it, expect } from "vitest";
import { actionCategory, actionCategoryColors } from "./actionCategory";
import { createBlankAction, createBlankAttack, type ActionDef } from "./unitTypes";

function action(patch: Partial<ActionDef> = {}): ActionDef {
  return { ...createBlankAction(0), ...patch };
}

describe("actionCategory", () => {
  it("is 'state' for null/undefined (no Action chosen yet)", () => {
    expect(actionCategory(null)).toBe("state");
    expect(actionCategory(undefined)).toBe("state");
  });

  it("is 'attack' whenever the Action fires something, even if it also moves", () => {
    const a = action({ movementPercent: 100, attack: createBlankAttack() });
    expect(actionCategory(a)).toBe("attack");
  });

  it("is 'movement' for a moving, non-firing Action", () => {
    const a = action({ movementPercent: 50, attack: null });
    expect(actionCategory(a)).toBe("movement");
  });

  it("is 'state' for a stationary, non-firing Action (pure dwell/toggle)", () => {
    const a = action({ movementPercent: 0, attack: null });
    expect(actionCategory(a)).toBe("state");
  });
});

describe("actionCategoryColors", () => {
  it("gives each category a distinct fill color", () => {
    const movement = actionCategoryColors(action({ movementPercent: 100, attack: null }));
    const attack = actionCategoryColors(action({ attack: createBlankAttack() }));
    const state = actionCategoryColors(action({ movementPercent: 0, attack: null }));
    const fills = new Set([movement.fill, attack.fill, state.fill]);
    expect(fills.size).toBe(3);
  });

  it("falls back to the 'state' color for a missing Action", () => {
    expect(actionCategoryColors(null)).toEqual(actionCategoryColors(action({ movementPercent: 0, attack: null })));
  });
});
