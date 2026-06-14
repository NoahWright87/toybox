import { describe, it, expect } from "vitest";
import { generateTurtleLayout } from "./layout";
import { generateSolvableBoard } from "./board";

describe("generateSolvableBoard", () => {
  it("assigns a real design to every slot, across many seeds", () => {
    const slots = generateTurtleLayout();
    for (let i = 0; i < 50; i++) {
      const board = generateSolvableBoard(slots);
      expect(board.length).toBe(144);
      for (const tile of board) {
        expect(tile.designId).not.toBe("");
      }
    }
  });
});
