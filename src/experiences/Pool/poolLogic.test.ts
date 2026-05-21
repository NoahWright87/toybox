import { describe, it, expect } from 'vitest';
import { processTurnEnd, groupBalls } from './poolLogic';
import type { GState, Ball, Player } from './poolLogic';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBall(num: number, pocketed = false): Ball {
  return { num, x: 0, y: 0, vx: 0, vy: 0, spinX: 0, spinY: 0, pocketed, rotAngle: 0 };
}

function makeState(overrides: Partial<GState> = {}): GState {
  const p0: Player = { name: 'Alice', group: 'solids', isAI: false, color: '#fff' };
  const p1: Player = { name: 'Bob',   group: 'stripes', isAI: false, color: '#fff' };
  return {
    balls: [makeBall(0), ...Array.from({ length: 15 }, (_, i) => makeBall(i + 1))],
    phase: 'aiming',
    turn: 0,
    players: [p0, p1],
    foul: false,
    isBreak: false,
    pocketedThisTurn: [],
    sunkBalls: [],
    winner: null,
    msg: '',
    aimAngle: 0,
    englishX: 0,
    englishY: 0,
    inHandPos: { x: 210, y: 210 },
    firstBallHit: null,
    ...overrides,
  };
}

/** Mark balls as pocketed and return a fresh ball list */
function withPocketed(ballNums: number[]): Ball[] {
  return [makeBall(0), ...Array.from({ length: 15 }, (_, i) => {
    const n = i + 1;
    return makeBall(n, ballNums.includes(n));
  })];
}

// ── groupBalls ────────────────────────────────────────────────────────────────
describe('groupBalls', () => {
  const balls = Array.from({ length: 15 }, (_, i) => makeBall(i + 1));

  it('returns solids 1–7 for solids group', () => {
    const result = groupBalls(balls, 'solids');
    expect(result.map(b => b.num)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('returns stripes 9–15 for stripes group', () => {
    const result = groupBalls(balls, 'stripes');
    expect(result.map(b => b.num)).toEqual([9, 10, 11, 12, 13, 14, 15]);
  });

  it('returns all non-cue non-8 balls when group is null', () => {
    const all = [makeBall(0), ...balls, makeBall(8)];
    const result = groupBalls(all, null);
    expect(result.map(b => b.num)).toEqual([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
  });
});

// ── 8-ball win/loss ───────────────────────────────────────────────────────────
describe('processTurnEnd — 8-ball', () => {
  it('player wins when they sink the 8-ball after clearing all solids', () => {
    // Alice has pocketed all solids (1–7) in previous turns; now sinks 8-ball
    const balls = withPocketed([1, 2, 3, 4, 5, 6, 7, 8]); // 8 pocketed this turn too
    const gs = makeState({
      balls,
      pocketedThisTurn: [8],
      firstBallHit: 8,        // hit the 8-ball first — legal because no solids remain
      sunkBalls: [1, 2, 3, 4, 5, 6, 7],
    });
    const next = processTurnEnd(gs);
    expect(next.phase).toBe('over');
    expect(next.winner).toBe(0);
    expect(next.msg).toContain('Alice wins');
  });

  it('player wins when they pocket their last solid AND the 8-ball in the same shot', () => {
    // Last solid (7) plus 8-ball both go in; solids player hit ball 7 first
    const balls = withPocketed([1, 2, 3, 4, 5, 6, 7, 8]);
    const gs = makeState({
      balls,
      pocketedThisTurn: [7, 8],
      firstBallHit: 7,         // hit a solid first — legal
      sunkBalls: [1, 2, 3, 4, 5, 6],
    });
    const next = processTurnEnd(gs);
    expect(next.phase).toBe('over');
    expect(next.winner).toBe(0);
  });

  it('player loses when they sink the 8-ball while solids remain', () => {
    // Solids 1–6 are pocketed; ball 7 is still on the table; player sinks 8-ball
    const balls = withPocketed([1, 2, 3, 4, 5, 6, 8]);
    const gs = makeState({
      balls,
      pocketedThisTurn: [8],
      firstBallHit: 8,
      sunkBalls: [1, 2, 3, 4, 5, 6],
    });
    const next = processTurnEnd(gs);
    expect(next.phase).toBe('over');
    expect(next.winner).toBe(1); // opponent wins
    expect(next.msg).toContain('illegally');
  });

  it('player loses when they foul AND sink the 8-ball', () => {
    // All solids cleared; player hits a stripe first (foul) then 8-ball goes in
    const balls = withPocketed([1, 2, 3, 4, 5, 6, 7, 8]);
    const gs = makeState({
      balls,
      pocketedThisTurn: [8],
      firstBallHit: 9,         // hit opponent's stripe first — foul even when going for 8
      sunkBalls: [1, 2, 3, 4, 5, 6, 7],
    });
    const next = processTurnEnd(gs);
    expect(next.phase).toBe('over');
    expect(next.winner).toBe(1);
  });

  it('player loses on scratch while sinking the 8-ball', () => {
    const balls = withPocketed([1, 2, 3, 4, 5, 6, 7, 8]);
    // Mark cue ball pocketed too
    balls[0].pocketed = true;
    const gs = makeState({
      balls,
      pocketedThisTurn: [0, 8], // scratch + 8
      firstBallHit: 8,
      sunkBalls: [1, 2, 3, 4, 5, 6, 7],
    });
    const next = processTurnEnd(gs);
    expect(next.phase).toBe('over');
    expect(next.winner).toBe(1);
  });

  // The previously-broken case: hitting 8-ball first was falsely flagged as a foul
  it('does NOT foul when player targets 8-ball and hits it first (all group balls cleared)', () => {
    const balls = withPocketed([1, 2, 3, 4, 5, 6, 7, 8]);
    const gs = makeState({
      balls,
      pocketedThisTurn: [8],
      firstBallHit: 8,
      sunkBalls: [1, 2, 3, 4, 5, 6, 7],
    });
    const next = processTurnEnd(gs);
    // Should be a WIN, not a loss
    expect(next.winner).toBe(0);
    expect(next.winner).not.toBe(1);
  });
});

// ── Scratch / inhand ──────────────────────────────────────────────────────────
describe('processTurnEnd — scratch', () => {
  it('switches turn on scratch', () => {
    const balls = withPocketed([0]); // cue ball pocketed
    balls[0].pocketed = true;
    const gs = makeState({ balls, turn: 0, pocketedThisTurn: [0], firstBallHit: 5 });
    const next = processTurnEnd(gs);
    expect(next.turn).toBe(1);
  });

  it('sets phase to inhand on scratch', () => {
    const balls = withPocketed([0]);
    balls[0].pocketed = true;
    const gs = makeState({ balls, pocketedThisTurn: [0], firstBallHit: 3 });
    const next = processTurnEnd(gs);
    expect(next.phase).toBe('inhand');
  });

  it('leaves cue ball pocketed after scratch (placement deferred to UI)', () => {
    const balls = withPocketed([0]);
    balls[0].pocketed = true;
    const gs = makeState({ balls, pocketedThisTurn: [0], firstBallHit: 3 });
    const next = processTurnEnd(gs);
    const cue = next.balls.find(b => b.num === 0);
    expect(cue?.pocketed).toBe(true);
  });

  it('includes scratch message', () => {
    const balls = withPocketed([0]);
    balls[0].pocketed = true;
    const gs = makeState({ balls, pocketedThisTurn: [0], firstBallHit: 3 });
    const next = processTurnEnd(gs);
    expect(next.msg.toLowerCase()).toContain('scratch');
  });
});

// ── Turn logic ────────────────────────────────────────────────────────────────
describe('processTurnEnd — turn switching', () => {
  it('keeps the same turn when player pockets one of their own balls', () => {
    const balls = withPocketed([1]);
    const gs = makeState({ balls, pocketedThisTurn: [1], firstBallHit: 1, sunkBalls: [] });
    const next = processTurnEnd(gs);
    expect(next.turn).toBe(0);
    expect(next.phase).toBe('aiming');
  });

  it('switches turn when player pockets nothing', () => {
    const gs = makeState({ pocketedThisTurn: [], firstBallHit: 5 });
    const next = processTurnEnd(gs);
    expect(next.turn).toBe(1);
  });

  it('switches turn on foul (wrong ball hit first)', () => {
    const gs = makeState({ pocketedThisTurn: [], firstBallHit: 9 }); // Alice is solids; hit stripe
    const next = processTurnEnd(gs);
    expect(next.turn).toBe(1);
    expect(next.msg.toLowerCase()).toContain('foul');
  });
});
