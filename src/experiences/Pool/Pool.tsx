import React, { useRef, useEffect, useState, useCallback } from 'react';
import './Pool.css';

// ── Canvas dimensions ─────────────────────────────────────────────────────────
const CW = 760;
const CH = 420;

// ── Table geometry ────────────────────────────────────────────────────────────
const RAIL_W = 14;
const CUSH_W  = 26;
const BORDER  = RAIL_W + CUSH_W;

const PF_X1 = BORDER;
const PF_X2 = CW - BORDER;
const PF_Y1 = BORDER;
const PF_Y2 = CH - BORDER;
const PF_W  = PF_X2 - PF_X1;
const PF_H  = PF_Y2 - PF_Y1;

// ── Ball & pocket ─────────────────────────────────────────────────────────────
const BR = 11;
const PR = 17;

// ── Physics ───────────────────────────────────────────────────────────────────
const FRICTION   = 0.9882;
const SPIN_DECAY = 0.88;
const CUSH_REST  = 0.76;
const BALL_REST  = 0.95;
const MIN_SPEED  = 0.012;

// ── Controls ──────────────────────────────────────────────────────────────────
const MAX_VEL       = 22;
// Aim / English lerp: rampedLerp() grows the lerp factor from 0 to max over ~25 frames,
// giving a short acceleration ramp so a tap nudges and a hold travels — see CLAUDE.md.
const AIM_LERP_MAX  = 0.18;
const AIM_LERP_RAMP = 0.008;
const ENG_LERP_MAX  = 0.15;
const ENG_LERP_RAMP = 0.007;

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

// ── Stick color presets ───────────────────────────────────────────────────────
const STICK_COLORS = [
  '#c8a055', // Maple
  '#3d2510', // Ebony
  '#cc2211', // Red
  '#1e3eb8', // Blue
  '#1a7030', // Green
  '#5b2d8e', // Purple
  '#cc5500', // Orange
  '#e8dfc0', // Ivory
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ball {
  num: number;
  x: number; y: number;
  vx: number; vy: number;
  spinX: number; spinY: number;
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
  color: string;
}

interface GState {
  balls: Ball[];
  phase: Phase;
  turn: 0 | 1;
  players: [Player, Player];
  foul: boolean;
  isBreak: boolean;
  pocketedThisTurn: number[];
  sunkBalls: number[];  // all non-cue non-8 balls sunk this game
  winner: 0 | 1 | null;
  msg: string;
  aimAngle: number;
  englishX: number;
  englishY: number;
  inHandPos: { x: number; y: number };
  firstBallHit: number | null;
}

interface MouseSt {
  x: number; y: number;
  down: boolean;
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

  const scratch      = pocketedThisTurn.includes(0);
  const eight        = pocketedThisTurn.includes(8);
  const currentGroup = players[turn].group;
  const oppTurn      = (1 - turn) as 0 | 1;

  // Accumulate newly-sunk regular balls
  const newlySunk = pocketedThisTurn.filter(n => n !== 0 && n !== 8);
  const sunkBalls = [...gs.sunkBalls, ...newlySunk];

  if (!isBreak && !scratch && firstBallHit !== null) {
    const hitSolid  = firstBallHit >= 1 && firstBallHit <= 7;
    const hitStripe = firstBallHit >= 9 && firstBallHit <= 15;
    if (currentGroup === 'solids'  && !hitSolid)  foul = true;
    if (currentGroup === 'stripes' && !hitStripe) foul = true;
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
    const cb = balls.find(b => b.num === 0);
    if (cb) { cb.pocketed = false; cb.x = CUE_HOME.x; cb.y = CUE_HOME.y; cb.vx = 0; cb.vy = 0; }
    return {
      ...gs, sunkBalls, players: newPlayers, turn: nextTurn, isBreak: false,
      phase: 'inhand', inHandPos: { ...CUE_HOME },
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

function drawStick(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  angle: number, power: number,
  color: string,
): void {
  const len = 200, backAng = angle + Math.PI;
  const gap = BR + 3 + power * 44;
  const tx = cx + Math.cos(backAng) * gap, ty = cy + Math.sin(backAng) * gap;
  const bx = cx + Math.cos(backAng) * (gap + len), by = cy + Math.sin(backAng) * (gap + len);

  const g = ctx.createLinearGradient(tx, ty, bx, by);
  g.addColorStop(0, '#e8d8a8');
  g.addColorStop(0.25, liftColor(color, 40));
  g.addColorStop(0.7, color);
  g.addColorStop(1, liftColor(color, -40));
  ctx.strokeStyle = g; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx, by); ctx.stroke();

  ctx.strokeStyle = '#8ab0d0'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(tx, ty);
  ctx.lineTo(tx + Math.cos(backAng) * 10, ty + Math.sin(backAng) * 10); ctx.stroke();
}

function renderFrame(ctx: CanvasRenderingContext2D, gs: GState, shotPower: number): void {
  ctx.clearRect(0, 0, CW, CH);

  ctx.fillStyle = '#7a4010';
  ctx.fillRect(0, 0, CW, CH);

  ctx.fillStyle = '#1a6020';
  ctx.fillRect(RAIL_W, RAIL_W, CW - RAIL_W * 2, CH - RAIL_W * 2);

  const felt = ctx.createLinearGradient(PF_X1, PF_Y1, PF_X2, PF_Y2);
  felt.addColorStop(0, '#1e7525'); felt.addColorStop(1, '#165a1c');
  ctx.fillStyle = felt;
  ctx.fillRect(PF_X1, PF_Y1, PF_W, PF_H);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(CW / 2, PF_Y1); ctx.lineTo(CW / 2, PF_Y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(HEAD_X, PF_Y1); ctx.lineTo(HEAD_X, PF_Y2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.arc(FOOT_X, FOOT_Y, 3, 0, Math.PI * 2); ctx.fill();

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

  if (gs.phase === 'inhand') {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(gs.inHandPos.x, gs.inHandPos.y, BR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(gs.inHandPos.x, gs.inHandPos.y, BR, 0, Math.PI * 2); ctx.stroke();
  }

  for (const b of gs.balls) {
    if (!b.pocketed) drawBall(ctx, b);
  }

  if (humanAiming && cue) {
    drawStick(ctx, cue.x, cue.y, gs.aimAngle, shotPower, gs.players[gs.turn].color);
  }
}

// ── Ramped lerp ───────────────────────────────────────────────────────────────
// Returns next lerp speed, growing from 0 toward max over several frames.
// Use for aim and English controls so a tap nudges and a hold travels (see CLAUDE.md).
function rampedLerp(current: number, ramp: number, max: number): number {
  return Math.min(max, current + ramp);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCircleNums(group: Group | null): number[] {
  if (group === 'solids')  return [1, 2, 3, 4, 5, 6, 7];
  if (group === 'stripes') return [9, 10, 11, 12, 13, 14, 15];
  return [0, 0, 0, 0, 0, 0, 0]; // unassigned: 7 blanks
}

// ── Component ─────────────────────────────────────────────────────────────────
interface PoolProps {
  onQuit?: () => void;
}

export default function Pool({ onQuit }: PoolProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const gsRef       = useRef<GState | null>(null);
  const rafRef      = useRef<number>(0);
  const mouseRef    = useRef<MouseSt>({ x: CW / 2, y: CH / 2, down: false });
  const firstHitRef = useRef<{ value: number | null }>({ value: null });
  const aiTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diffRef     = useRef<AIDiff>('normal');

  // Aim lerp ramp state
  const aimLerpRef  = useRef(0);
  const invertAimRef = useRef(false);

  // English lerp state (all imperative — no React state needed for position)
  const engBallRef   = useRef<HTMLDivElement>(null);
  const engDotRef    = useRef<HTMLDivElement>(null);
  const engDownRef   = useRef(false);
  const engTargetRef = useRef({ x: 0, y: 0 });
  const engLerpRef   = useRef(0);

  // Cue drag (shooting)
  const cuePowerRef     = useRef(0);
  const cueDraggingRef  = useRef(false);
  const cueDragStartY   = useRef(0);
  const cueDragAreaH    = useRef(120);

  // Menu
  const menuRef = useRef<HTMLDivElement>(null);

  // ── React state ────────────────────────────────────────────────────────────
  const [gamePhase, setGamePhase] = useState<'setup' | 'playing'>('setup');
  const [mode,      setMode]      = useState<Mode>('hvh');
  const [diff,      setDiff]      = useState<AIDiff>('normal');
  const [p0name,    setP0name]    = useState('Player 1');
  const [p1name,    setP1name]    = useState('Player 2');
  const [p0color,   setP0color]   = useState(STICK_COLORS[0]);
  const [p1color,   setP1color]   = useState(STICK_COLORS[1]);
  const [invertAim, setInvertAim] = useState(false);
  const [menuOpen,  setMenuOpen]  = useState<'game' | 'options' | null>(null);
  const [cuePower,  setCuePower]  = useState(0);

  // Synced UI state (driven by game loop transitions)
  const [uiPhase,     setUiPhase]     = useState<Phase>('aiming');
  const [uiTurn,      setUiTurn]      = useState<0 | 1>(0);
  const [uiGroups,    setUiGroups]    = useState<[Group | null, Group | null]>([null, null]);
  const [uiWinner,    setUiWinner]    = useState<0 | 1 | null>(null);
  const [uiMsg,       setUiMsg]       = useState('');
  const [uiNames,     setUiNames]     = useState<[string, string]>(['Player 1', 'Player 2']);
  const [uiColors,    setUiColors]    = useState<[string, string]>([STICK_COLORS[0], STICK_COLORS[1]]);
  const [uiSunkBalls, setUiSunkBalls] = useState<number[]>([]);

  useEffect(() => { diffRef.current = diff; }, [diff]);
  useEffect(() => { invertAimRef.current = invertAim; }, [invertAim]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const syncUi = useCallback((gs: GState) => {
    setUiPhase(gs.phase);
    setUiTurn(gs.turn);
    setUiGroups([gs.players[0].group, gs.players[1].group]);
    setUiWinner(gs.winner);
    setUiMsg(gs.msg);
    setUiNames([gs.players[0].name, gs.players[1].name]);
    setUiColors([gs.players[0].color, gs.players[1].color]);
    setUiSunkBalls([...gs.sunkBalls]);
  }, []);

  const resetEngDot = useCallback(() => {
    if (engDotRef.current) {
      engDotRef.current.style.left = '50%';
      engDotRef.current.style.top  = '50%';
    }
  }, []);

  // ── Fire shot ──────────────────────────────────────────────────────────────
  const fireShot = useCallback((power: number) => {
    const gs = gsRef.current;
    if (!gs || gs.phase !== 'aiming' || gs.players[gs.turn].isAI) return;
    const cb = gs.balls.find(b => b.num === 0 && !b.pocketed);
    if (!cb) return;
    firstHitRef.current.value = null;
    cb.vx = Math.cos(gs.aimAngle) * power * MAX_VEL;
    cb.vy = Math.sin(gs.aimAngle) * power * MAX_VEL;
    cb.spinX = gs.englishX;
    cb.spinY = gs.englishY;
    gsRef.current = {
      ...gs, phase: 'moving',
      pocketedThisTurn: [], firstBallHit: null, msg: '',
      englishX: 0, englishY: 0,
    };
    resetEngDot();
    syncUi(gsRef.current);
  }, [syncUi, resetEngDot]);

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
        ...cur, phase: 'moving', aimAngle: shot.angle,
        pocketedThisTurn: [], firstBallHit: null, msg: '',
        englishX: 0, englishY: 0,
      };
      gsRef.current = next;
      resetEngDot();
      syncUi(next);
    }, 900);
  }, [syncUi, resetEngDot]);

  const startGame = useCallback((m: Mode, n0: string, n1: string, c0: string, c1: string) => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    const players: [Player, Player] = [
      { name: n0, group: null, isAI: false, color: c0 },
      { name: n1, group: null, isAI: m === 'hvai', color: c1 },
    ];
    const gs: GState = {
      balls: createBalls(), phase: 'aiming', turn: 0, players,
      isBreak: true, pocketedThisTurn: [], sunkBalls: [], winner: null,
      msg: `${n0}'s break!`, aimAngle: 0,
      englishX: 0, englishY: 0, inHandPos: { ...CUE_HOME }, firstBallHit: null,
      foul: false,
    };
    gsRef.current = gs;
    firstHitRef.current.value = null;
    cuePowerRef.current = 0;
    setCuePower(0);
    aimLerpRef.current = 0;
    engLerpRef.current = 0;
    resetEngDot();
    setGamePhase('playing');
    syncUi(gs);
  }, [syncUi, resetEngDot]);

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
        // Aim lerp: rotates stick toward pointer while held (ramped speed)
        if (gs.phase === 'aiming' && mouseRef.current.down && !gs.players[gs.turn].isAI) {
          const cb = gs.balls.find(b => b.num === 0 && !b.pocketed);
          if (cb) {
            const raw = Math.atan2(mouseRef.current.y - cb.y, mouseRef.current.x - cb.x);
            // inverted: stick butt follows finger → aim points opposite
            const target = invertAimRef.current ? raw + Math.PI : raw;
            let d = target - gs.aimAngle;
            while (d > Math.PI)  d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            aimLerpRef.current = rampedLerp(aimLerpRef.current, AIM_LERP_RAMP, AIM_LERP_MAX);
            gs.aimAngle += d * aimLerpRef.current;
          }
        }

        // English lerp: moves spin dot toward pointer while held (ramped speed)
        if (gs.phase === 'aiming' && engDownRef.current && !gs.players[gs.turn].isAI) {
          engLerpRef.current = rampedLerp(engLerpRef.current, ENG_LERP_RAMP, ENG_LERP_MAX);
          const t = engTargetRef.current;
          gs.englishX += (t.x - gs.englishX) * engLerpRef.current;
          gs.englishY += (t.y - gs.englishY) * engLerpRef.current;
          const mag = Math.hypot(gs.englishX, gs.englishY);
          if (mag > 1) { gs.englishX /= mag; gs.englishY /= mag; }
          if (engDotRef.current) {
            engDotRef.current.style.left = `calc(50% + ${gs.englishX * 22}px)`;
            engDotRef.current.style.top  = `calc(50% + ${-gs.englishY * 22}px)`;
          }
        }

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
        renderFrame(ctx, gsRef.current!, cuePowerRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [gamePhase, syncUi, fireAI]);

  // ── Canvas events (aim + inhand placement) ────────────────────────────────
  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) * CW / r.width, y: (clientY - r.top) * CH / r.height };
  }, []);

  const canvasXY = useCallback((e: React.MouseEvent<HTMLCanvasElement>) =>
    clientToCanvas(e.clientX, e.clientY), [clientToCanvas]);

  const handleCanvasDown = useCallback((x: number, y: number) => {
    const m = mouseRef.current;
    m.down = true; m.x = x; m.y = y;
    aimLerpRef.current = 0; // reset ramp on each new touch
    const gs = gsRef.current;
    if (gs?.phase === 'inhand') {
      gs.inHandPos = {
        x: Math.max(PF_X1 + BR, Math.min(PF_X2 - BR, x)),
        y: Math.max(PF_Y1 + BR, Math.min(PF_Y2 - BR, y)),
      };
    }
  }, []);

  const handleCanvasMove = useCallback((x: number, y: number) => {
    const m = mouseRef.current;
    m.x = x; m.y = y;
    const gs = gsRef.current;
    if (gs?.phase === 'inhand') {
      gs.inHandPos = {
        x: Math.max(PF_X1 + BR, Math.min(PF_X2 - BR, x)),
        y: Math.max(PF_Y1 + BR, Math.min(PF_Y2 - BR, y)),
      };
    }
  }, []);

  const handleCanvasUp = useCallback(() => {
    mouseRef.current.down = false;
    const gs = gsRef.current;
    if (!gs || gs.phase !== 'inhand') return;
    const pos = gs.inHandPos;
    const ok = !gs.balls.some(
      b => !b.pocketed && b.num !== 0 && Math.hypot(b.x - pos.x, b.y - pos.y) < BR * 2 + 2,
    );
    if (ok) {
      const cb = gs.balls.find(b => b.num === 0);
      if (cb) { cb.pocketed = false; cb.x = pos.x; cb.y = pos.y; cb.vx = 0; cb.vy = 0; }
      gsRef.current = { ...gs, phase: 'aiming' };
      syncUi(gsRef.current);
    }
  }, [syncUi]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasXY(e); handleCanvasDown(x, y);
  }, [canvasXY, handleCanvasDown]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasXY(e); handleCanvasMove(x, y);
  }, [canvasXY, handleCanvasMove]);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0]; if (!t) return;
    const { x, y } = clientToCanvas(t.clientX, t.clientY); handleCanvasDown(x, y);
  }, [clientToCanvas, handleCanvasDown]);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0]; if (!t) return;
    const { x, y } = clientToCanvas(t.clientX, t.clientY); handleCanvasMove(x, y);
  }, [clientToCanvas, handleCanvasMove]);

  // ── English pointer events ────────────────────────────────────────────────
  const getEngPos = (clientX: number, clientY: number, ball: HTMLElement) => {
    const r = ball.getBoundingClientRect();
    return {
      x: Math.max(-1, Math.min(1, (clientX - r.left - r.width  / 2) / (r.width  / 2))),
      y: Math.max(-1, Math.min(1, -(clientY - r.top  - r.height / 2) / (r.height / 2))),
    };
  };

  const onEngPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    engDownRef.current  = true;
    engLerpRef.current  = 0;
    engTargetRef.current = getEngPos(e.clientX, e.clientY, e.currentTarget);
  }, []);

  const onEngPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!engDownRef.current) return;
    engTargetRef.current = getEngPos(e.clientX, e.clientY, e.currentTarget);
  }, []);

  const onEngPointerUp = useCallback(() => { engDownRef.current = false; }, []);

  // ── Side cue drag (shooting) ──────────────────────────────────────────────
  const onCuePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const gs = gsRef.current;
    if (!gs || gs.phase !== 'aiming' || gs.players[gs.turn].isAI) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    cueDraggingRef.current = true;
    cueDragStartY.current  = e.clientY;
    cueDragAreaH.current   = e.currentTarget.getBoundingClientRect().height;
    cuePowerRef.current = 0;
    setCuePower(0);
  }, []);

  const onCuePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!cueDraggingRef.current) return;
    const p = Math.max(0, Math.min(1, (e.clientY - cueDragStartY.current) / cueDragAreaH.current));
    cuePowerRef.current = p;
    setCuePower(p);
  }, []);

  const onCuePointerUp = useCallback(() => {
    if (!cueDraggingRef.current) return;
    cueDraggingRef.current = false;
    const power = cuePowerRef.current;
    cuePowerRef.current = 0;
    setCuePower(0);
    if (power > 0.02) fireShot(power);
  }, [fireShot]);

  // ── Derived values for render ─────────────────────────────────────────────
  const gs = gsRef.current;
  const isHumanTurn = gs && !gs.players[gs.turn].isAI;
  const showControls = isHumanTurn && uiPhase === 'aiming';
  const p0Circles = getCircleNums(uiGroups[0]);
  const p1Circles = getCircleNums(uiGroups[1]);

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (gamePhase === 'setup') {
    return (
      <div className="pool-setup">
        <div className="pool-setup__title">8-BALL POOL</div>
        <div className="pool-setup__row">
          <button className={`pool-btn${mode === 'hvh'  ? ' pool-btn--on' : ''}`} onClick={() => setMode('hvh')}>2 Players</button>
          <button className={`pool-btn${mode === 'hvai' ? ' pool-btn--on' : ''}`} onClick={() => setMode('hvai')}>vs Computer</button>
        </div>
        <div className="pool-setup__fields">
          <label className="pool-setup__label">Player 1 name</label>
          <input className="pool-setup__inp" value={p0name} maxLength={16} onChange={e => setP0name(e.target.value)} />
          <div className="pool-setup__swatches">
            {STICK_COLORS.map(c => (
              <button
                key={c}
                className={`pool-swatch${p0color === c ? ' pool-swatch--on' : ''}`}
                style={{ background: c }}
                onClick={() => setP0color(c)}
                title={c}
              />
            ))}
          </div>

          <label className="pool-setup__label">{mode === 'hvh' ? 'Player 2 name' : 'Difficulty'}</label>
          {mode === 'hvh'
            ? <>
                <input className="pool-setup__inp" value={p1name} maxLength={16} onChange={e => setP1name(e.target.value)} />
                <div className="pool-setup__swatches">
                  {STICK_COLORS.map(c => (
                    <button
                      key={c}
                      className={`pool-swatch${p1color === c ? ' pool-swatch--on' : ''}`}
                      style={{ background: c }}
                      onClick={() => setP1color(c)}
                      title={c}
                    />
                  ))}
                </div>
              </>
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
          <button
            className="pool-btn pool-btn--primary"
            onClick={() => startGame(mode, p0name || 'Player 1', mode === 'hvh' ? (p1name || 'Player 2') : `CPU (${diff})`, p0color, p1color)}
          >
            BREAK!
          </button>
        </div>
      </div>
    );
  }

  // ── Game screen ───────────────────────────────────────────────────────────
  const hintText = uiPhase === 'inhand'
    ? 'Drag cue ball · release to place'
    : showControls
    ? 'Tap/hold to aim · drag cue down to shoot'
    : uiMsg;

  const activeName = (idx: 0 | 1) =>
    uiTurn === idx && uiPhase !== 'moving' && uiPhase !== 'over';

  return (
    <div className="pool-game">

      {/* ── Win95 menu bar ── */}
      <div className="pool-menubar" ref={menuRef}>
        <div className="pool-menu-group">
          <button
            className={`pool-menu-btn${menuOpen === 'game' ? ' pool-menu-btn--open' : ''}`}
            onClick={() => setMenuOpen(menuOpen === 'game' ? null : 'game')}
          >
            Game
          </button>
          {menuOpen === 'game' && (
            <div className="pool-menu-dropdown">
              <button className="pool-menu-opt" onClick={() => { setMenuOpen(null); setGamePhase('setup'); }}>
                New Game...
              </button>
              {onQuit && <div className="pool-menu-divider" />}
              {onQuit && (
                <button className="pool-menu-opt" onClick={() => { setMenuOpen(null); onQuit(); }}>
                  Exit
                </button>
              )}
            </div>
          )}
        </div>
        <div className="pool-menu-group">
          <button
            className={`pool-menu-btn${menuOpen === 'options' ? ' pool-menu-btn--open' : ''}`}
            onClick={() => setMenuOpen(menuOpen === 'options' ? null : 'options')}
          >
            Options
          </button>
          {menuOpen === 'options' && (
            <div className="pool-menu-dropdown">
              <button className="pool-menu-opt" onClick={() => setInvertAim(v => !v)}>
                {invertAim ? '☑' : '☐'} Invert Aim
              </button>
            </div>
          )}
        </div>
        <div className="pool-menubar__hint">{hintText}</div>
      </div>

      {/* ── Canvas ── */}
      <div className="pool-canvas-wrap">
        <canvas
          ref={canvasRef} width={CW} height={CH} className="pool-canvas"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={handleCanvasUp}
          onMouseLeave={() => { mouseRef.current.down = false; }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove}
          onTouchEnd={handleCanvasUp}
        />
        {uiPhase === 'over' && (
          <div className="pool-over">
            <div className="pool-over__box">
              <div className="pool-over__title">GAME OVER</div>
              <div className="pool-over__winner">{uiWinner !== null ? uiNames[uiWinner] : ''} wins!</div>
              <div className="pool-over__msg">{uiMsg}</div>
              <div className="pool-over__btns">
                <button className="pool-btn pool-btn--primary" onClick={() => setGamePhase('setup')}>New Game</button>
                {onQuit && <button className="pool-btn" onClick={onQuit}>Exit</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom panel ── */}
      <div className="pool-bottom">

        {/* P1 side */}
        <div className="pool-player-side">
          <div className="pool-ball-tray">
            {p0Circles.map((num, i) => (
              <div
                key={i}
                className="pool-ball-circle"
                style={num > 0 && uiSunkBalls.includes(num)
                  ? { background: BALL_CLR[num], borderColor: '#444' }
                  : {}}
              />
            ))}
          </div>

          {showControls && uiTurn === 0 && (
            <div
              className="pool-side-cue"
              onPointerDown={onCuePointerDown}
              onPointerMove={onCuePointerMove}
              onPointerUp={onCuePointerUp}
              onPointerCancel={onCuePointerUp}
            >
              <div className="pool-side-cue__ball" />
              <div
                className="pool-side-cue__body"
                style={{
                  top: `${22 + cuePower * 70}px`,
                  background: `linear-gradient(to bottom, #e8d8a8 0%, ${liftColor(uiColors[0], 30)} 30%, ${uiColors[0]} 100%)`,
                }}
              />
            </div>
          )}

          <div className={`pool-player-name${activeName(0) ? ' pool-player-name--active' : ''}`}>
            {uiNames[0]}
          </div>
        </div>

        {/* English center */}
        <div className="pool-center">
          <div className="pool-english__label">ENGLISH</div>
          <div
            ref={engBallRef}
            className="pool-english__ball"
            onPointerDown={onEngPointerDown}
            onPointerMove={onEngPointerMove}
            onPointerUp={onEngPointerUp}
            onPointerCancel={onEngPointerUp}
            title="Tap/drag to set spin"
          >
            <div ref={engDotRef} className="pool-english__dot" />
          </div>
        </div>

        {/* P2 side (mirrored) */}
        <div className="pool-player-side pool-player-side--right">
          <div className={`pool-player-name${activeName(1) ? ' pool-player-name--active' : ''}`}>
            {uiNames[1]}
          </div>

          {showControls && uiTurn === 1 && (
            <div
              className="pool-side-cue"
              onPointerDown={onCuePointerDown}
              onPointerMove={onCuePointerMove}
              onPointerUp={onCuePointerUp}
              onPointerCancel={onCuePointerUp}
            >
              <div className="pool-side-cue__ball" />
              <div
                className="pool-side-cue__body"
                style={{
                  top: `${22 + cuePower * 70}px`,
                  background: `linear-gradient(to bottom, #e8d8a8 0%, ${liftColor(uiColors[1], 30)} 30%, ${uiColors[1]} 100%)`,
                }}
              />
            </div>
          )}

          <div className="pool-ball-tray pool-ball-tray--right">
            {p1Circles.map((num, i) => (
              <div
                key={i}
                className="pool-ball-circle"
                style={num > 0 && uiSunkBalls.includes(num)
                  ? { background: BALL_CLR[num], borderColor: '#444' }
                  : {}}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
