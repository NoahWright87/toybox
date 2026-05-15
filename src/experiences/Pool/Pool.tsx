import React, { useRef, useEffect, useState, useCallback } from 'react';
import './Pool.css';

// ── Canvas dimensions ─────────────────────────────────────────────────────────
const CW = 760;
const CH = 420;

// ── Table geometry ────────────────────────────────────────────────────────────
const RAIL_W = 14;
const CUSH_W  = 26;
const BORDER  = RAIL_W + CUSH_W; // 40

const PF_X1 = BORDER;
const PF_X2 = CW - BORDER;
const PF_Y1 = BORDER;
const PF_Y2 = CH - BORDER;
const PF_W  = PF_X2 - PF_X1; // 680
const PF_H  = PF_Y2 - PF_Y1; // 340

// ── Ball & pocket ─────────────────────────────────────────────────────────────
const BR = 11;  // ball radius
const PR = 17;  // pocket capture radius

// ── Physics ───────────────────────────────────────────────────────────────────
const FRICTION   = 0.9882;
const SPIN_DECAY = 0.88;
const CUSH_REST  = 0.76;
const BALL_REST  = 0.95;
const MIN_SPEED  = 0.012;

// ── Shooting ──────────────────────────────────────────────────────────────────
const MAX_DRAG_PX   = 180;
const MAX_VEL       = 22;
const ROTATE_SENS   = 0.010; // radians per canvas-pixel of lateral drag

// ── Key positions ─────────────────────────────────────────────────────────────
const FOOT_X   = PF_X1 + PF_W * 0.75;
const FOOT_Y   = PF_Y1 + PF_H * 0.5;
const HEAD_X   = PF_X1 + PF_W * 0.25;
const CUE_HOME = { x: HEAD_X, y: FOOT_Y };

// ── Pockets ───────────────────────────────────────────────────────────────────
const POCKETS: { x: number; y: number }[] = [
  { x: PF_X1 + 2, y: PF_Y1 + 2 },
  { x: CW / 2,    y: PF_Y1 - 4 },
  { x: PF_X2 - 2, y: PF_Y1 + 2 },
  { x: PF_X1 + 2, y: PF_Y2 - 2 },
  { x: CW / 2,    y: PF_Y2 + 4 },
  { x: PF_X2 - 2, y: PF_Y2 - 2 },
];

// ── Ball colors ───────────────────────────────────────────────────────────────
const BALL_CLR: Record<number, string> = {
  1: '#f5c400', 2: '#1e3eb8', 3: '#cc1100',
  4: '#5b2d8e', 5: '#cc5500', 6: '#228833', 7: '#7a0000',
  8: '#1a1a1a',
  9: '#f5c400', 10: '#1e3eb8', 11: '#cc1100',
  12: '#5b2d8e', 13: '#cc5500', 14: '#228833', 15: '#7a0000',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ball {
  num: number;
  x: number; y: number;
  vx: number; vy: number;
  spinX: number;
  spinY: number;
  pocketed: boolean;
}

type Group  = 'solids' | 'stripes';
type Phase  = 'aiming' | 'moving' | 'inhand' | 'over';
type Mode   = 'hvh' | 'hvai';
type AIDiff = 'easy' | 'normal' | 'hard';

interface Player {
  name: string;
  group: Group | null;
  isAI: boolean;
}

interface GState {
  balls: Ball[];
  phase: Phase;
  turn: 0 | 1;
  players: [Player, Player];
  foul: boolean;
  isBreak: boolean;
  pocketedThisTurn: number[];
  winner: 0 | 1 | null;
  msg: string;
  aimAngle: number;
  power: number;
  englishX: number;
  englishY: number;
  inHandPos: { x: number; y: number };
  firstBallHit: number | null;
}

interface MouseSt {
  x: number; y: number;
  down: boolean; downX: number; downY: number;
  locked: boolean; lockedAngle: number;
}

// ── Rack ─────────────────────────────────────────────────────────────────────
function createBalls(): Ball[] {
  const dx = BR * Math.sqrt(3);
  const dy = BR * 2 + 0.5;
  const rows: number[][] = [
    [1],
    [9, 2],
    [3, 8, 10],
    [11, 4, 5, 12],
    [6, 13, 14, 7, 15],
  ];
  const balls: Ball[] = [
    { num: 0, x: CUE_HOME.x, y: CUE_HOME.y, vx: 0, vy: 0, spinX: 0, spinY: 0, pocketed: false },
  ];
  rows.forEach((row, ri) => {
    row.forEach((num, ci) => {
      balls.push({
        num,
        x: FOOT_X + ri * dx,
        y: FOOT_Y + (ci - (row.length - 1) / 2) * dy,
        vx: 0, vy: 0, spinX: 0, spinY: 0, pocketed: false,
      });
    });
  });
  return balls;
}

// ── Physics step ──────────────────────────────────────────────────────────────
function stepBalls(balls: Ball[], firstHit: { value: number | null }): number[] {
  const pocketed: number[] = [];

  // Move + friction
  for (const b of balls) {
    if (b.pocketed) continue;
    b.x  += b.vx; b.y  += b.vy;
    b.vx *= FRICTION; b.vy *= FRICTION;
    b.spinX *= SPIN_DECAY; b.spinY *= SPIN_DECAY;
    if (Math.abs(b.vx)    < MIN_SPEED) b.vx    = 0;
    if (Math.abs(b.vy)    < MIN_SPEED) b.vy    = 0;
    if (Math.abs(b.spinX) < 0.001) b.spinX = 0;
    if (Math.abs(b.spinY) < 0.001) b.spinY = 0;
  }

  // Ball-ball collisions
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      if (a.pocketed || b.pocketed) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const minD = BR * 2;
      if (d2 >= minD * minD || d2 < 0.0001) continue;

      const dist = Math.sqrt(d2);
      const nx = dx / dist, ny = dy / dist;
      const ov = minD - dist;
      a.x -= nx * ov * 0.5; a.y -= ny * ov * 0.5;
      b.x += nx * ov * 0.5; b.y += ny * ov * 0.5;

      if (a.num === 0 && firstHit.value === null) firstHit.value = b.num;
      if (b.num === 0 && firstHit.value === null) firstHit.value = a.num;

      const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
      const dot = dvx * nx + dvy * ny;
      if (dot < 0) {
        const imp = dot * (1 + BALL_REST) * 0.5;
        const prevAvx = a.vx, prevAvy = a.vy;
        a.vx += imp * nx; a.vy += imp * ny;
        b.vx -= imp * nx; b.vy -= imp * ny;

        // English effect on cue ball
        if (a.num === 0 && (a.spinX !== 0 || a.spinY !== 0)) {
          const spd = Math.hypot(prevAvx, prevAvy);
          const ang = Math.atan2(prevAvy, prevAvx);
          a.vx += a.spinY * Math.cos(ang) * spd * 0.28;
          a.vy += a.spinY * Math.sin(ang) * spd * 0.28;
          const perp = ang + Math.PI / 2;
          a.vx += a.spinX * Math.cos(perp) * spd * 0.18;
          a.vy += a.spinX * Math.sin(perp) * spd * 0.18;
          a.spinX = 0; a.spinY = 0;
        } else if (b.num === 0) {
          b.spinX = 0; b.spinY = 0;
        }
      }
    }
  }

  // Pockets & cushions
  for (const b of balls) {
    if (b.pocketed) continue;
    let sunk = false;
    for (const p of POCKETS) {
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < (PR + BR * 0.4) * (PR + BR * 0.4)) {
        b.pocketed = true; b.vx = 0; b.vy = 0; b.spinX = 0; b.spinY = 0;
        pocketed.push(b.num); sunk = true; break;
      }
    }
    if (sunk) continue;

    let bounced = false;
    if (b.x - BR < PF_X1) {
      b.x = PF_X1 + BR; b.vx = Math.abs(b.vx) * CUSH_REST;
      b.vy += b.spinX * 0.25; bounced = true;
    } else if (b.x + BR > PF_X2) {
      b.x = PF_X2 - BR; b.vx = -Math.abs(b.vx) * CUSH_REST;
      b.vy -= b.spinX * 0.25; bounced = true;
    }
    if (b.y - BR < PF_Y1) {
      b.y = PF_Y1 + BR; b.vy = Math.abs(b.vy) * CUSH_REST;
      b.vx += b.spinX * 0.25; bounced = true;
    } else if (b.y + BR > PF_Y2) {
      b.y = PF_Y2 - BR; b.vy = -Math.abs(b.vy) * CUSH_REST;
      b.vx -= b.spinX * 0.25; bounced = true;
    }
    if (bounced) { b.spinX *= 0.4; b.spinY *= 0.4; }
  }

  return pocketed;
}

function anyMoving(balls: Ball[]): boolean {
  return balls.some(b => !b.pocketed && (Math.abs(b.vx) > MIN_SPEED || Math.abs(b.vy) > MIN_SPEED));
}

// ── Game logic ────────────────────────────────────────────────────────────────
function groupBalls(balls: Ball[], group: Group | null): Ball[] {
  if (!group) return balls.filter(b => b.num !== 0 && b.num !== 8);
  if (group === 'solids') return balls.filter(b => b.num >= 1 && b.num <= 7);
  return balls.filter(b => b.num >= 9 && b.num <= 15);
}

function processTurnEnd(gs: GState): GState {
  const { turn, players, balls, pocketedThisTurn, firstBallHit, isBreak } = gs;
  const newPlayers: [Player, Player] = [{ ...players[0] }, { ...players[1] }];
  let nextTurn: 0 | 1 = turn;
  let foul = false;
  let msg = '';

  const scratch       = pocketedThisTurn.includes(0);
  const eight         = pocketedThisTurn.includes(8);
  const currentGroup  = players[turn].group;
  const oppTurn       = (1 - turn) as 0 | 1;

  // Check illegal first contact
  if (!isBreak && !scratch && firstBallHit !== null) {
    const hitSolid  = firstBallHit >= 1 && firstBallHit <= 7;
    const hitStripe = firstBallHit >= 9 && firstBallHit <= 15;
    if (currentGroup === 'solids'  && !hitSolid)   foul = true;
    if (currentGroup === 'stripes' && !hitStripe)  foul = true;
  }
  if (firstBallHit === null && !isBreak) foul = true; // no ball touched

  // 8-ball sunk
  if (eight) {
    const activeMine = groupBalls(balls.filter(b => !b.pocketed), currentGroup);
    if (foul || scratch || activeMine.length > 0) {
      return { ...gs, players: newPlayers, winner: oppTurn, phase: 'over',
        msg: `${newPlayers[oppTurn].name} wins — ${newPlayers[turn].name} sank the 8-ball illegally!` };
    }
    return { ...gs, players: newPlayers, winner: turn, phase: 'over',
      msg: `${newPlayers[turn].name} wins! 🎱` };
  }

  // Assign groups on first non-break ball sunk
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

  // Scratch → ball in hand
  if (scratch) {
    nextTurn = oppTurn;
    const cb = balls.find(b => b.num === 0);
    if (cb) { cb.pocketed = false; cb.x = CUE_HOME.x; cb.y = CUE_HOME.y; cb.vx = 0; cb.vy = 0; }
    return {
      ...gs, players: newPlayers, turn: nextTurn, isBreak: false,
      phase: 'inhand', inHandPos: { ...CUE_HOME },
      pocketedThisTurn: [], firstBallHit: null, foul: false,
      msg: `Scratch! ${newPlayers[nextTurn].name} has ball in hand.`,
    };
  }

  // Determine pocket-own / pocket-opp
  const myGroup = newPlayers[turn].group;
  const pocketedOwn = pocketedThisTurn.some(n => {
    if (n === 0 || n === 8) return false;
    if (!myGroup) return true;
    return myGroup === 'solids' ? n >= 1 && n <= 7 : n >= 9 && n <= 15;
  });
  const pocketedOpp = pocketedThisTurn.some(n => {
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
    ...gs, players: newPlayers, turn: nextTurn, isBreak: false,
    phase: 'aiming', pocketedThisTurn: [], firstBallHit: null, foul: false,
    msg,
  };
}

// ── AI ────────────────────────────────────────────────────────────────────────
function getAIShot(
  balls: Ball[], turn: 0 | 1, players: [Player, Player], difficulty: AIDiff,
): { angle: number; power: number; englishX: number; englishY: number } {
  const cue = balls.find(b => b.num === 0 && !b.pocketed);
  if (!cue) return { angle: 0, power: 0.5, englishX: 0, englishY: 0 };

  const group  = players[turn].group;
  const active = balls.filter(b => !b.pocketed && b.num !== 0 && b.num !== 8);
  const mine   = groupBalls(active, group);
  const targets: Ball[] = mine.length > 0
    ? mine
    : balls.filter(b => b.num === 8 && !b.pocketed);

  const noise = difficulty === 'easy' ? 0.20 : difficulty === 'normal' ? 0.09 : 0.025;

  let bestAngle = 0, bestPower = 0.45, bestQ = -1;

  for (const target of targets) {
    for (const pocket of POCKETS) {
      const tdx = pocket.x - target.x, tdy = pocket.y - target.y;
      const td  = Math.hypot(tdx, tdy);
      if (td < 1) continue;
      const ghostX = target.x - (tdx / td) * BR * 2;
      const ghostY = target.y - (tdy / td) * BR * 2;
      if (ghostX < PF_X1 + BR || ghostX > PF_X2 - BR ||
          ghostY < PF_Y1 + BR || ghostY > PF_Y2 - BR) continue;

      const cdx = ghostX - cue.x, cdy = ghostY - cue.y;
      const cd  = Math.hypot(cdx, cdy);
      if (cd < 1) continue;
      const angle = Math.atan2(cdy, cdx);

      let blocked = false;
      for (const ob of balls) {
        if (ob.pocketed || ob.num === 0 || ob.num === target.num) continue;
        const t = ((ob.x - cue.x) * cdx + (ob.y - cue.y) * cdy) / (cd * cd);
        if (t < 0.08 || t > 0.95) continue;
        const px = cue.x + t * cdx, py = cue.y + t * cdy;
        if (Math.hypot(ob.x - px, ob.y - py) < BR * 2.1) { blocked = true; break; }
      }
      if (blocked) continue;
      let blocked2 = false;
      for (const ob of balls) {
        if (ob.pocketed || ob.num === target.num || ob.num === 0) continue;
        const t = ((ob.x - target.x) * tdx + (ob.y - target.y) * tdy) / (td * td);
        if (t < 0.1 || t > 0.95) continue;
        const px = target.x + t * tdx, py = target.y + t * tdy;
        if (Math.hypot(ob.x - px, ob.y - py) < BR * 2.1) { blocked2 = true; break; }
      }
      if (blocked2) continue;

      const q = 1 / (cd + td * 0.5);
      if (q > bestQ) {
        bestQ = q; bestAngle = angle;
        bestPower = Math.min(1, Math.max(0.35, cd / 350 + 0.3));
      }
    }
  }

  if (bestQ < 0) {
    const t = targets[0] ?? balls.find(b => !b.pocketed && b.num !== 0);
    if (t) { bestAngle = Math.atan2(t.y - cue.y, t.x - cue.x); bestPower = 0.45; }
  }

  return {
    angle: bestAngle + (Math.random() - 0.5) * 2 * noise,
    power: bestPower, englishX: 0, englishY: 0,
  };
}

// ── Render helpers ────────────────────────────────────────────────────────────
function liftColor(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.min(255, (n >> 16) + amt)},${Math.min(255, ((n >> 8) & 0xff) + amt)},${Math.min(255, (n & 0xff) + amt)})`;
}

function ghostBallDist(balls: Ball[], cue: Ball, angle: number): number {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let minD = Infinity;
  for (const b of balls) {
    if (b.pocketed || b.num === 0) continue;
    const t = (b.x - cue.x) * dx + (b.y - cue.y) * dy;
    if (t < BR) continue;
    const px = cue.x + t * dx, py = cue.y + t * dy;
    const perp = Math.hypot(b.x - px, b.y - py);
    if (perp < BR * 2) {
      const hit = t - Math.sqrt(Math.max(0, (BR * 2) ** 2 - perp * perp));
      if (hit < minD) minD = hit;
    }
  }
  return minD === Infinity ? 0 : minD;
}

function drawBall(ctx: CanvasRenderingContext2D, b: Ball): void {
  ctx.beginPath();
  ctx.arc(b.x, b.y, BR, 0, Math.PI * 2);

  if (b.num === 0) {
    const g = ctx.createRadialGradient(b.x - 3, b.y - 4, 1, b.x, b.y, BR);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c8c8c8');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 0.8; ctx.stroke();
    return;
  }

  const color = BALL_CLR[b.num];
  const stripe = b.num >= 9;
  if (stripe) {
    ctx.fillStyle = '#f0f0f0'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(b.x - BR, b.y - BR * 0.52, BR * 2, BR * 1.04);
    ctx.restore();
  } else {
    const g = ctx.createRadialGradient(b.x - 3, b.y - 4, 1, b.x, b.y, BR);
    g.addColorStop(0, liftColor(color, 45)); g.addColorStop(1, color);
    ctx.fillStyle = g; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(b.x, b.y, BR, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(b.x, b.y, BR * 0.40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = `bold ${Math.round(BR * 0.62)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(b.num), b.x, b.y + 0.5);
}

function drawStick(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, power: number): void {
  const len = 200, backAng = angle + Math.PI;
  const gap = BR + 3 + power * 44;
  const tx = cx + Math.cos(backAng) * gap, ty = cy + Math.sin(backAng) * gap;
  const bx = cx + Math.cos(backAng) * (gap + len), by = cy + Math.sin(backAng) * (gap + len);

  const g = ctx.createLinearGradient(tx, ty, bx, by);
  g.addColorStop(0, '#e8d8a8'); g.addColorStop(0.2, '#c8a055');
  g.addColorStop(0.7, '#8a5020'); g.addColorStop(1, '#5a2808');
  ctx.strokeStyle = g; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx, by); ctx.stroke();

  ctx.strokeStyle = '#8ab0d0'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(tx, ty);
  ctx.lineTo(tx + Math.cos(backAng) * 10, ty + Math.sin(backAng) * 10); ctx.stroke();
}

function renderFrame(ctx: CanvasRenderingContext2D, gs: GState): void {
  ctx.clearRect(0, 0, CW, CH);

  // Rail
  ctx.fillStyle = '#7a4010';
  ctx.fillRect(0, 0, CW, CH);

  // Cushion
  ctx.fillStyle = '#1a6020';
  ctx.fillRect(RAIL_W, RAIL_W, CW - RAIL_W * 2, CH - RAIL_W * 2);

  // Felt
  const felt = ctx.createLinearGradient(PF_X1, PF_Y1, PF_X2, PF_Y2);
  felt.addColorStop(0, '#1e7525'); felt.addColorStop(1, '#165a1c');
  ctx.fillStyle = felt;
  ctx.fillRect(PF_X1, PF_Y1, PF_W, PF_H);

  // Guide lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(CW / 2, PF_Y1); ctx.lineTo(CW / 2, PF_Y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(HEAD_X, PF_Y1); ctx.lineTo(HEAD_X, PF_Y2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.arc(FOOT_X, FOOT_Y, 3, 0, Math.PI * 2); ctx.fill();

  // Pockets
  for (const p of POCKETS) {
    const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, PR + 6);
    pg.addColorStop(0, 'rgba(0,0,0,0.9)'); pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(p.x, p.y, PR + 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath(); ctx.arc(p.x, p.y, PR, 0, Math.PI * 2); ctx.fill();
  }

  const cue = gs.balls.find(b => b.num === 0 && !b.pocketed);
  const humanAiming = gs.phase === 'aiming' && cue && !gs.players[gs.turn].isAI;

  // Aim aids
  if (humanAiming && cue) {
    const angle = gs.aimAngle;
    const gd    = ghostBallDist(gs.balls, cue, angle);
    if (gd > 0) {
      const gx = cue.x + Math.cos(angle) * gd, gy = cue.y + Math.sin(angle) * gd;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(gx, gy, BR, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1; ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(cue.x, cue.y);
    const ld = gd > 0 ? gd : 350;
    ctx.lineTo(cue.x + Math.cos(angle) * ld, cue.y + Math.sin(angle) * ld);
    ctx.stroke(); ctx.setLineDash([]);
  }

  // In-hand placement preview
  if (gs.phase === 'inhand') {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(gs.inHandPos.x, gs.inHandPos.y, BR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(gs.inHandPos.x, gs.inHandPos.y, BR, 0, Math.PI * 2); ctx.stroke();
  }

  // Balls
  for (const b of gs.balls) {
    if (!b.pocketed) drawBall(ctx, b);
  }

  // Cue stick
  if (humanAiming && cue) drawStick(ctx, cue.x, cue.y, gs.aimAngle, gs.power);
}

// ── Component ─────────────────────────────────────────────────────────────────
interface PoolProps {
  onQuit?: () => void;
}

export default function Pool({ onQuit }: PoolProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const gsRef      = useRef<GState | null>(null);
  const rafRef     = useRef<number>(0);
  const mouseRef   = useRef<MouseSt>({
    x: CW / 2, y: CH / 2, down: false, downX: 0, downY: 0,
    locked: false, lockedAngle: 0,
  });
  const firstHitRef = useRef<{ value: number | null }>({ value: null });
  const aiTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diffRef     = useRef<AIDiff>('normal');

  const [gamePhase, setGamePhase] = useState<'setup' | 'playing'>('setup');
  const [mode,      setMode]      = useState<Mode>('hvh');
  const [diff,      setDiff]      = useState<AIDiff>('normal');
  const [p0name,    setP0name]    = useState('Player 1');
  const [p1name,    setP1name]    = useState('Player 2');
  const [englishX,  setEnglishX]  = useState(0);
  const [englishY,  setEnglishY]  = useState(0);
  const [displayPow, setDisplayPow] = useState(0);

  // UI overlay state
  const [uiPhase,  setUiPhase]  = useState<Phase>('aiming');
  const [uiTurn,   setUiTurn]   = useState<0 | 1>(0);
  const [uiGroups, setUiGroups] = useState<[Group | null, Group | null]>([null, null]);
  const [uiWinner, setUiWinner] = useState<0 | 1 | null>(null);
  const [uiMsg,    setUiMsg]    = useState('');
  const [uiNames,  setUiNames]  = useState<[string, string]>(['Player 1', 'Player 2']);

  useEffect(() => { diffRef.current = diff; }, [diff]);

  const syncUi = useCallback((gs: GState) => {
    setUiPhase(gs.phase);
    setUiTurn(gs.turn);
    setUiGroups([gs.players[0].group, gs.players[1].group]);
    setUiWinner(gs.winner);
    setUiMsg(gs.msg);
    setUiNames([gs.players[0].name, gs.players[1].name]);
  }, []);

  const fireAI = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => {
      const cur = gsRef.current;
      if (!cur || cur.phase !== 'aiming' || !cur.players[cur.turn].isAI) return;
      const shot = getAIShot(cur.balls, cur.turn, cur.players, diffRef.current);
      const cb   = cur.balls.find(b => b.num === 0 && !b.pocketed);
      if (!cb) return;
      firstHitRef.current.value = null;
      cb.vx = Math.cos(shot.angle) * shot.power * MAX_VEL;
      cb.vy = Math.sin(shot.angle) * shot.power * MAX_VEL;
      cb.spinX = 0; cb.spinY = 0;
      const next: GState = {
        ...cur, phase: 'moving', aimAngle: shot.angle, power: shot.power,
        pocketedThisTurn: [], firstBallHit: null, msg: '',
      };
      gsRef.current = next;
      syncUi(next);
    }, 900);
  }, [syncUi]);

  const startGame = useCallback((m: Mode, n0: string, n1: string) => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    const players: [Player, Player] = [
      { name: n0, group: null, isAI: false },
      { name: n1, group: null, isAI: m === 'hvai' },
    ];
    const gs: GState = {
      balls: createBalls(), phase: 'aiming', turn: 0, players,
      isBreak: true, pocketedThisTurn: [], winner: null,
      msg: `${n0}'s break!`, aimAngle: 0, power: 0,
      englishX: 0, englishY: 0, inHandPos: { ...CUE_HOME }, firstBallHit: null,
      foul: false,
    };
    gsRef.current = gs;
    firstHitRef.current.value = null;
    setEnglishX(0); setEnglishY(0); setDisplayPow(0);
    setGamePhase('playing');
    syncUi(gs);
  }, [syncUi]);

  // ── Game loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tick = () => {
      const gs = gsRef.current;
      if (gs) {
        if (gs.phase === 'moving') {
          const sunk = stepBalls(gs.balls, firstHitRef.current);
          if (sunk.length) gs.pocketedThisTurn = [...gs.pocketedThisTurn, ...sunk];

          if (!anyMoving(gs.balls)) {
            const next = processTurnEnd({ ...gs, firstBallHit: firstHitRef.current.value });
            firstHitRef.current.value = null;
            gsRef.current = next;
            syncUi(next);
            if (next.phase === 'aiming' && next.players[next.turn].isAI) fireAI();
          }
        }
        renderFrame(ctx, gsRef.current!);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [gamePhase, syncUi, fireAI]);

  // ── Canvas events ──────────────────────────────────────────────────────────
  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) * CW / r.width, y: (clientY - r.top) * CH / r.height };
  }, []);

  const canvasXY = useCallback((e: React.MouseEvent<HTMLCanvasElement>) =>
    clientToCanvas(e.clientX, e.clientY), [clientToCanvas]);

  // Shared pointer-down: lock the current aim angle as the drag reference.
  // Power resets to 0 so each drag starts fresh.
  const handlePointerDown = useCallback((x: number, y: number) => {
    const m = mouseRef.current;
    m.down = true; m.downX = x; m.downY = y;
    const gs = gsRef.current;
    if (!gs || gs.players[gs.turn].isAI) return;
    if (gs.phase === 'aiming') {
      m.locked = true;
      m.lockedAngle = gs.aimAngle;
      gs.power = 0;
      setDisplayPow(0);
    }
  }, []);

  // Shared pointer-move: decompose drag displacement into two components:
  //   • backward (along -aimAngle): sets power proportionally
  //   • lateral  (perpendicular):   rotates aim angle proportionally
  // This keeps the finger away from the aim line so the shot stays visible.
  const handlePointerMove = useCallback((x: number, y: number) => {
    const m = mouseRef.current;
    m.x = x; m.y = y;
    const gs = gsRef.current;
    if (!gs || gs.phase === 'moving' || gs.players[gs.turn].isAI) return;

    if (gs.phase === 'aiming') {
      if (!m.down || !m.locked) return;
      const dx = x - m.downX;
      const dy = y - m.downY;
      const a  = m.lockedAngle;
      // Backward component: displacement opposite to aim direction → power
      const back = -dx * Math.cos(a) - dy * Math.sin(a);
      gs.power = Math.max(0, Math.min(1, back / MAX_DRAG_PX));
      setDisplayPow(gs.power);
      // Lateral component: displacement perpendicular to aim → rotation
      const lat = dx * Math.sin(a) - dy * Math.cos(a);
      gs.aimAngle = a + lat * ROTATE_SENS;
    } else if (gs.phase === 'inhand') {
      gs.inHandPos = {
        x: Math.max(PF_X1 + BR, Math.min(PF_X2 - BR, x)),
        y: Math.max(PF_Y1 + BR, Math.min(PF_Y2 - BR, y)),
      };
    }
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasXY(e);
    handlePointerMove(x, y);
  }, [canvasXY, handlePointerMove]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasXY(e);
    handlePointerDown(x, y);
  }, [canvasXY, handlePointerDown]);

  const onMouseUp = useCallback(() => {
    const m = mouseRef.current;
    m.down = false; m.locked = false;
    const gs = gsRef.current;
    if (!gs || gs.players[gs.turn].isAI) return;

    if (gs.phase === 'aiming' && gs.power > 0.02) {
      const cb = gs.balls.find(b => b.num === 0 && !b.pocketed);
      if (!cb) return;
      firstHitRef.current.value = null;
      cb.vx = Math.cos(gs.aimAngle) * gs.power * MAX_VEL;
      cb.vy = Math.sin(gs.aimAngle) * gs.power * MAX_VEL;
      cb.spinX = gs.englishX;
      cb.spinY = gs.englishY;
      gsRef.current = {
        ...gs, phase: 'moving', power: 0,
        pocketedThisTurn: [], firstBallHit: null, msg: '',
        englishX: 0, englishY: 0,
      };
      setDisplayPow(0); setEnglishX(0); setEnglishY(0);
      syncUi(gsRef.current);
    } else if (gs.phase === 'inhand') {
      const pos = gs.inHandPos;
      const ok  = !gs.balls.some(b => !b.pocketed && b.num !== 0 && Math.hypot(b.x - pos.x, b.y - pos.y) < BR * 2 + 2);
      if (ok) {
        const cb = gs.balls.find(b => b.num === 0);
        if (cb) { cb.pocketed = false; cb.x = pos.x; cb.y = pos.y; cb.vx = 0; cb.vy = 0; }
        gsRef.current = { ...gs, phase: 'aiming', power: 0 };
        syncUi(gsRef.current);
      }
    }
  }, [syncUi]);

  // ── Touch events (mirrors pointer logic above) ────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0];
    if (!t) return;
    const { x, y } = clientToCanvas(t.clientX, t.clientY);
    handlePointerDown(x, y);
  }, [clientToCanvas, handlePointerDown]);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0];
    if (!t) return;
    const { x, y } = clientToCanvas(t.clientX, t.clientY);
    handlePointerMove(x, y);
  }, [clientToCanvas, handlePointerMove]);

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    // changedTouches[0] has the position of the lifted finger, but onMouseUp
    // doesn't need position, so just forward the shared release logic.
    void e;
    onMouseUp();
  }, [onMouseUp]);

  // ── Full-power shot (escape hatch when near a cushion) ───────────────────
  const fireFullPower = useCallback(() => {
    const gs = gsRef.current;
    if (!gs || gs.phase !== 'aiming' || gs.players[gs.turn].isAI) return;
    const cb = gs.balls.find(b => b.num === 0 && !b.pocketed);
    if (!cb) return;
    firstHitRef.current.value = null;
    cb.vx = Math.cos(gs.aimAngle) * MAX_VEL;
    cb.vy = Math.sin(gs.aimAngle) * MAX_VEL;
    cb.spinX = gs.englishX;
    cb.spinY = gs.englishY;
    gsRef.current = {
      ...gs, phase: 'moving', power: 0,
      pocketedThisTurn: [], firstBallHit: null, msg: '',
      englishX: 0, englishY: 0,
    };
    setDisplayPow(0); setEnglishX(0); setEnglishY(0);
    syncUi(gsRef.current);
  }, [syncUi]);

  // ── English indicator ─────────────────────────────────────────────────────
  const onEnglishClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r  = e.currentTarget.getBoundingClientRect();
    const cx = r.width / 2, cy = r.height / 2;
    const dx = e.clientX - r.left - cx;
    const dy = e.clientY - r.top  - cy;
    if (Math.hypot(dx, dy) > r.width / 2) return;
    const ex = Math.max(-1, Math.min(1, dx / (r.width / 2)));
    const ey = Math.max(-1, Math.min(1, -dy / (r.height / 2)));
    setEnglishX(ex); setEnglishY(ey);
    if (gsRef.current) { gsRef.current.englishX = ex; gsRef.current.englishY = ey; }
  }, []);

  const resetEnglish = useCallback(() => {
    setEnglishX(0); setEnglishY(0);
    if (gsRef.current) { gsRef.current.englishX = 0; gsRef.current.englishY = 0; }
  }, []);

  // ── Ball counts ────────────────────────────────────────────────────────────
  const gs = gsRef.current;
  const alive = gs ? gs.balls.filter(b => !b.pocketed) : [];
  const p0Left = groupBalls(alive.filter(b => b.num !== 0 && b.num !== 8), uiGroups[0]).length;
  const p1Left = groupBalls(alive.filter(b => b.num !== 0 && b.num !== 8), uiGroups[1]).length;
  const isHuman = gs && !gs.players[gs.turn].isAI;

  // ── Setup screen ───────────────────────────────────────────────────────────
  if (gamePhase === 'setup') {
    return (
      <div className="pool-setup">
        <div className="pool-setup__title">8-BALL POOL</div>
        <div className="pool-setup__row">
          <button className={`pool-btn${mode === 'hvh'  ? ' pool-btn--on' : ''}`} onClick={() => setMode('hvh')}>2 Players</button>
          <button className={`pool-btn${mode === 'hvai' ? ' pool-btn--on' : ''}`} onClick={() => setMode('hvai')}>vs Computer</button>
        </div>
        <div className="pool-setup__fields">
          <label className="pool-setup__label">Player 1</label>
          <input className="pool-setup__inp" value={p0name} maxLength={16} onChange={e => setP0name(e.target.value)} />
          <label className="pool-setup__label">{mode === 'hvh' ? 'Player 2' : 'Difficulty'}</label>
          {mode === 'hvh'
            ? <input className="pool-setup__inp" value={p1name} maxLength={16} onChange={e => setP1name(e.target.value)} />
            : <div className="pool-setup__row">
                {(['easy', 'normal', 'hard'] as AIDiff[]).map(d => (
                  <button key={d} className={`pool-btn${diff === d ? ' pool-btn--on' : ''}`} onClick={() => setDiff(d)}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
          }
        </div>
        <div className="pool-setup__actions">
          <button className="pool-btn pool-btn--primary" onClick={() => startGame(mode, p0name || 'Player 1', mode === 'hvh' ? (p1name || 'Player 2') : `CPU (${diff})`)}>
            BREAK!
          </button>
          {onQuit && <button className="pool-btn" onClick={onQuit}>Quit</button>}
        </div>
      </div>
    );
  }

  // ── Game screen ────────────────────────────────────────────────────────────
  const groupLabel = (g: Group | null) =>
    g === 'solids' ? '● solids' : g === 'stripes' ? '◑ stripes' : '?';

  const hintText = uiPhase === 'inhand'
    ? 'Drag to place cue ball · tap/click to confirm'
    : uiPhase === 'aiming' && isHuman
    ? 'Drag sideways to rotate · drag back for power · release to shoot'
    : '';

  return (
    <div className="pool-game">
      {/* Score bar */}
      <div className="pool-bar">
        <div className={`pool-bar__player${uiTurn === 0 ? ' pool-bar__player--active' : ''}`}>
          <span className="pool-bar__name">{uiNames[0]}</span>
          <span className="pool-bar__group">{groupLabel(uiGroups[0])}</span>
          <span className="pool-bar__count">{p0Left}</span>
        </div>
        <div className="pool-bar__center">🎱</div>
        <div className={`pool-bar__player pool-bar__player--right${uiTurn === 1 ? ' pool-bar__player--active' : ''}`}>
          <span className="pool-bar__count">{p1Left}</span>
          <span className="pool-bar__group">{groupLabel(uiGroups[1])}</span>
          <span className="pool-bar__name">{uiNames[1]}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="pool-canvas-wrap">
        <canvas
          ref={canvasRef} width={CW} height={CH} className="pool-canvas"
          onMouseMove={onMouseMove} onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { mouseRef.current.down = false; mouseRef.current.locked = false; }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        />
        {uiPhase === 'over' && (
          <div className="pool-over">
            <div className="pool-over__box">
              <div className="pool-over__title">GAME OVER</div>
              <div className="pool-over__winner">{uiWinner !== null ? uiNames[uiWinner] : ''} wins!</div>
              <div className="pool-over__msg">{uiMsg}</div>
              <div className="pool-over__btns">
                <button className="pool-btn pool-btn--primary" onClick={() => setGamePhase('setup')}>New Game</button>
                {onQuit && <button className="pool-btn" onClick={onQuit}>Quit</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="pool-ctrl">
        <div className="pool-english">
          <div className="pool-english__label">ENGLISH</div>
          <div className="pool-english__ball" onClick={onEnglishClick} title="Click to set spin">
            <div className="pool-english__dot" style={{ left: `calc(50% + ${englishX * 22}px)`, top: `calc(50% + ${-englishY * 22}px)` }} />
          </div>
          <button className="pool-btn pool-english__rst" onClick={resetEnglish}>Ctr</button>
        </div>

        <div className="pool-power">
          <div className="pool-power__label">POWER</div>
          <div className="pool-power__track">
            <div className="pool-power__fill" style={{ width: `${displayPow * 100}%` }} />
          </div>
        </div>

        {isHuman && uiPhase === 'aiming' && (
          <button className="pool-btn pool-btn--fullpower" onClick={fireFullPower}>
            FULL<br />POWER
          </button>
        )}

        <div className="pool-hint">{hintText || uiMsg}</div>

        <div className="pool-ctrl__btns">
          <button className="pool-btn" onClick={() => setGamePhase('setup')}>New</button>
          {onQuit && <button className="pool-btn" onClick={onQuit}>Quit</button>}
        </div>
      </div>
    </div>
  );
}
