import { describe, it, expect } from "vitest";
import { advanceToNextSeason, createNewCareer } from "./careerState";
import { CAREER_STATE_VERSION } from "./types";

describe("createNewCareer", () => {
  it("starts at Season 1, no node taken yet, deadline at 0, ratings as given", () => {
    const career = createNewCareer(0, 1);
    expect(career.version).toBe(CAREER_STATE_VERSION);
    expect(career.season).toBe(1);
    expect(career.currentNodeId).toBeNull();
    expect(career.visitedNodeIds).toEqual([]);
    expect(career.deadlinePosition).toBe(0);
    expect(career.ratings).toBe(0);
    expect(career.phase).toBe("career");
    expect(career.finaleScore).toBeNull();
    expect(career.syndicationScore).toBeNull();
  });

  it("is deterministic given a seed (same seed -> same seasonMap)", () => {
    const a = createNewCareer(0, 7);
    const b = createNewCareer(0, 7);
    expect(a.seasonMap).toEqual(b.seasonMap);
  });

  it("starts with the placeholder weapon (build persistence stub)", () => {
    const career = createNewCareer(0, 1);
    expect(career.weapons).toEqual([{ weaponId: "placeholder", tier: 0 }]);
  });

  it("starts equipped with the default chassis (chassis.spec.md)", () => {
    const career = createNewCareer(0, 1);
    expect(career.chassisId).toBe("default");
  });

  it("starts with no gold/items and level 1 with zero exp/stat picks (economy.spec.todo.md, F9 #137)", () => {
    const career = createNewCareer(0, 1);
    expect(career.gold).toBe(0);
    expect(career.items).toEqual([]);
    expect(career.level).toBe(1);
    expect(career.exp).toBe(0);
    expect(career.statPicks).toEqual({});
  });
});

describe("advanceToNextSeason", () => {
  it("increments the season and resets map position/deadline/history", () => {
    const career = createNewCareer(200, 1);
    const advanced = advanceToNextSeason(
      { ...career, currentNodeId: career.seasonMap.bossNodeId, visitedNodeIds: ["x"], deadlinePosition: 5 },
      2
    );
    expect(advanced.season).toBe(2);
    expect(advanced.currentNodeId).toBeNull();
    expect(advanced.visitedNodeIds).toEqual([]);
    expect(advanced.deadlinePosition).toBe(0);
    expect(advanced.seasonMap.season).toBe(2);
  });

  it("carries Ratings and weapons forward (Season always advances, career state persists)", () => {
    const career = createNewCareer(300, 1);
    const advanced = advanceToNextSeason(career, 2);
    expect(advanced.ratings).toBe(300);
    expect(advanced.weapons).toEqual(career.weapons);
  });

  it("carries gold/items/level/exp/statPicks forward too — only the map/deadline reset each Season", () => {
    const career = {
      ...createNewCareer(300, 1),
      gold: 500,
      items: [{ itemId: "lucky-rabbits-foot", count: 2 }],
      level: 4,
      exp: 12,
      statPicks: { damage: 2 },
    };
    const advanced = advanceToNextSeason(career, 2);
    expect(advanced.gold).toBe(500);
    expect(advanced.items).toEqual(career.items);
    expect(advanced.level).toBe(4);
    expect(advanced.exp).toBe(12);
    expect(advanced.statPicks).toEqual({ damage: 2 });
  });
});
