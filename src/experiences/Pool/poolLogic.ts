// ── Types ─────────────────────────────────────────────────────────────────────
export interface Ball {
  num: number;
  x: number; y: number;
  vx: number; vy: number;
  spinX: number; spinY: number;
  pocketed: boolean;
  rotAngle: number;
}

export type Group  = 'solids' | 'stripes';
export type Phase  = 'aiming' | 'moving' | 'inhand' | 'over';

export interface Player {
  name: string;
  group: Group | null;
  isAI: boolean;
  color: string;
}

export interface GState {
  balls: Ball[];
  phase: Phase;
  turn: 0 | 1;
  players: [Player, Player];
  foul: boolean;
  isBreak: boolean;
  pocketedThisTurn: number[];
  sunkBalls: number[];
  winner: 0 | 1 | null;
  msg: string;
  aimAngle: number;
  englishX: number;
  englishY: number;
  inHandPos: { x: number; y: number };
  firstBallHit: number | null;
}

// Default cue-ball placement position (matches CUE_HOME in Pool.tsx)
export const DEFAULT_INHAND_POS = { x: 210, y: 210 };

// ── Game logic ────────────────────────────────────────────────────────────────
export function groupBalls(balls: Ball[], group: Group | null): Ball[] {
  if (!group) return balls.filter(b => b.num !== 0 && b.num !== 8);
  if (group === 'solids') return balls.filter(b => b.num >= 1 && b.num <= 7);
  return balls.filter(b => b.num >= 9 && b.num <= 15);
}

export function processTurnEnd(gs: GState): GState {
  const { turn, players, balls, pocketedThisTurn, firstBallHit, isBreak } = gs;
  const newPlayers: [Player, Player] = [{ ...players[0] }, { ...players[1] }];
  let nextTurn: 0 | 1 = turn;
  let foul = false;
  let msg = '';

  const scratch      = pocketedThisTurn.includes(0);
  const eight        = pocketedThisTurn.includes(8);
  const currentGroup = players[turn].group;
  const oppTurn      = (1 - turn) as 0 | 1;

  const newlySunk = pocketedThisTurn.filter(n => n !== 0 && n !== 8);
  const sunkBalls = [...gs.sunkBalls, ...newlySunk];

  // Wrong-ball-first foul.
  // When group balls remain: must hit one of your own group first.
  // When all group balls are cleared: must hit the 8-ball first.
  if (!isBreak && !scratch && firstBallHit !== null) {
    const hitSolid  = firstBallHit >= 1 && firstBallHit <= 7;
    const hitStripe = firstBallHit >= 9 && firstBallHit <= 15;
    const hitEight  = firstBallHit === 8;
    if (currentGroup === 'solids' && !hitSolid) {
      const remainSolids  = balls.filter(b => !b.pocketed && b.num >= 1 && b.num <= 7).length;
      const sunkSolidsNow = newlySunk.filter(n => n >= 1 && n <= 7).length;
      const hadSolids     = remainSolids + sunkSolidsNow > 0;
      if (hadSolids || !hitEight) foul = true;
    }
    if (currentGroup === 'stripes' && !hitStripe) {
      const remainStripes  = balls.filter(b => !b.pocketed && b.num >= 9 && b.num <= 15).length;
      const sunkStripesNow = newlySunk.filter(n => n >= 9 && n <= 15).length;
      const hadStripes     = remainStripes + sunkStripesNow > 0;
      if (hadStripes || !hitEight) foul = true;
    }
  }
  if (firstBallHit === null && !isBreak) foul = true;

  if (eight) {
    const activeMine = groupBalls(balls.filter(b => !b.pocketed), currentGroup);
    if (foul || scratch || activeMine.length > 0) {
      return { ...gs, sunkBalls, players: newPlayers, winner: oppTurn, phase: 'over',
        msg: `${newPlayers[oppTurn].name} wins — ${newPlayers[turn].name} sank the 8-ball illegally!` };
    }
    return { ...gs, sunkBalls, players: newPlayers, winner: turn, phase: 'over',
      msg: `${newPlayers[turn].name} wins! 🎱` };
  }

  if (newPlayers[0].group === null && !isBreak) {
    const solidsIn  = pocketedThisTurn.some(n => n >= 1 && n <= 7);
    const stripesIn = pocketedThisTurn.some(n => n >= 9 && n <= 15);
    if (solidsIn && !stripesIn) {
      newPlayers[turn].group = 'solids';
      newPlayers[oppTurn].group = 'stripes';
      msg = `${newPlayers[turn].name}: solids · ${newPlayers[oppTurn].name}: stripes`;
    } else if (stripesIn && !solidsIn) {
      newPlayers[turn].group = 'stripes';
      newPlayers[oppTurn].group = 'solids';
      msg = `${newPlayers[turn].name}: stripes · ${newPlayers[oppTurn].name}: solids`;
    }
  }

  if (scratch) {
    nextTurn = oppTurn;
    // Cue ball stays pocketed — placed via the inhand UI (or AI auto-placement)
    return {
      ...gs, sunkBalls, players: newPlayers, turn: nextTurn, isBreak: false,
      phase: 'inhand', inHandPos: { ...DEFAULT_INHAND_POS },
      pocketedThisTurn: [], firstBallHit: null, foul: false,
      msg: `Scratch! ${newPlayers[nextTurn].name} has ball in hand.`,
    };
  }

  const myGroup      = newPlayers[turn].group;
  const pocketedOwn  = pocketedThisTurn.some(n => {
    if (n === 0 || n === 8) return false;
    if (!myGroup) return true;
    return myGroup === 'solids' ? n >= 1 && n <= 7 : n >= 9 && n <= 15;
  });
  const pocketedOpp  = pocketedThisTurn.some(n => {
    if (n === 0 || n === 8 || !myGroup) return false;
    return myGroup === 'solids' ? n >= 9 && n <= 15 : n >= 1 && n <= 7;
  });

  if (foul || pocketedOpp) {
    nextTurn = oppTurn;
    if (!msg) msg = `Foul! ${newPlayers[nextTurn].name}'s turn.`;
  } else if (!pocketedOwn) {
    nextTurn = oppTurn;
  }
  if (!msg) {
    msg = nextTurn === turn
      ? `Nice! ${newPlayers[turn].name} shoots again.`
      : `${newPlayers[nextTurn].name}'s turn.`;
  }

  return {
    ...gs, sunkBalls, players: newPlayers, turn: nextTurn, isBreak: false,
    phase: 'aiming', pocketedThisTurn: [], firstBallHit: null, foul: false, msg,
  };
}
