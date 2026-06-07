import type { GooberConfig } from "./gooberFs";

export interface LayerDef {
  key: keyof GooberConfig;
  label: string;
  names: string[];
  defaultFrameCount: number;
  drawFrame: (ctx: CanvasRenderingContext2D, frameIdx: number, size: number) => void;
}

// ── Shared geometry constants (proportional to canvas size) ──────────────────
// Head center is at (0.5, 0.58) with radius 0.30 × size.
// Adjust cx/cy/hr if changing the avatar layout.

const HCX = 0.5;   // head center x fraction
const HCY = 0.58;  // head center y fraction
const HR  = 0.30;  // head radius fraction

function hc(size: number) {
  return { cx: size * HCX, cy: size * HCY, hr: size * HR };
}

const CAT_FILL   = "#f5e6d3";
const CAT_STROKE = "#2c1810";

// ── Background (6 frames) ────────────────────────────────────────────────────

const BACKGROUND_FILLS = [
  null,          // 0: transparent
  "#ffd6d6",     // 1: pastel pink
  "#d6d6ff",     // 2: pastel blue
  "#ffffd6",     // 3: pastel yellow
  "#d6ffd6",     // 4: pastel green
  "#eed6ff",     // 5: pastel purple
];

function drawBackground(ctx: CanvasRenderingContext2D, frameIdx: number, size: number) {
  const fill = BACKGROUND_FILLS[frameIdx];
  if (!fill) return;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, size, size);
}

// ── Body shape (4 frames) ────────────────────────────────────────────────────

function drawBodyShape(ctx: CanvasRenderingContext2D, frameIdx: number, size: number) {
  const { cx, cy, hr } = hc(size);
  const lw = size * 0.025;
  ctx.strokeStyle = CAT_STROKE;
  ctx.fillStyle = CAT_FILL;
  ctx.lineWidth = lw;

  switch (frameIdx) {
    case 0: { // Round circle
      ctx.beginPath();
      ctx.arc(cx, cy, hr, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 1: { // Square head
      const s = hr * 1.5;
      ctx.beginPath();
      ctx.roundRect(cx - s, cy - s, s * 2, s * 2, size * 0.04);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 2: { // Wide oval
      ctx.beginPath();
      ctx.ellipse(cx, cy, hr * 1.3, hr * 0.9, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 3: { // Tall oval / egg shape
      ctx.beginPath();
      ctx.ellipse(cx, cy, hr * 0.9, hr * 1.15, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
  }
}

// ── Body outfit (5 frames) ───────────────────────────────────────────────────

function drawBodyOutfit(ctx: CanvasRenderingContext2D, frameIdx: number, size: number) {
  if (frameIdx === 0) return; // bare
  const { cx, cy, hr } = hc(size);
  const lw = size * 0.022;
  ctx.lineWidth = lw;
  ctx.strokeStyle = CAT_STROKE;

  const chinY = cy + hr * 0.7; // visible neck/chest area

  switch (frameIdx) {
    case 1: { // Simple collar
      ctx.strokeStyle = "#cc6644";
      ctx.lineWidth = size * 0.03;
      ctx.beginPath();
      ctx.arc(cx, cy, hr * 0.85, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      break;
    }
    case 2: { // Dress neckline (V shape)
      ctx.strokeStyle = "#9966cc";
      ctx.lineWidth = lw;
      ctx.fillStyle = "#cc99ff";
      const neckW = hr * 0.45;
      ctx.beginPath();
      ctx.moveTo(cx - neckW, chinY);
      ctx.lineTo(cx, chinY + hr * 0.35);
      ctx.lineTo(cx + neckW, chinY);
      ctx.stroke();
      // Skirt shape (trapezoid)
      const dressTop = chinY + hr * 0.1;
      const dressBot = Math.min(size - size * 0.03, cy + hr * 1.3);
      ctx.beginPath();
      ctx.moveTo(cx - hr * 0.5, dressTop);
      ctx.lineTo(cx - hr * 0.7, dressBot);
      ctx.lineTo(cx + hr * 0.7, dressBot);
      ctx.lineTo(cx + hr * 0.5, dressTop);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }
    case 3: { // Tuxedo bow tie
      ctx.fillStyle = "#222222";
      ctx.strokeStyle = "#222222";
      const bx = cx, by = chinY + hr * 0.05;
      const bw = hr * 0.22, bh = hr * 0.14;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - bw, by - bh);
      ctx.lineTo(bx - bw, by + bh);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + bw, by - bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#555555";
      ctx.beginPath();
      ctx.arc(bx, by, bw * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 4: { // Overalls straps
      ctx.strokeStyle = "#4466aa";
      ctx.lineWidth = size * 0.03;
      const strapW = hr * 0.25;
      // Left strap
      ctx.beginPath();
      ctx.moveTo(cx - strapW, chinY - hr * 0.1);
      ctx.lineTo(cx - strapW * 0.6, chinY + hr * 0.5);
      ctx.stroke();
      // Right strap
      ctx.beginPath();
      ctx.moveTo(cx + strapW, chinY - hr * 0.1);
      ctx.lineTo(cx + strapW * 0.6, chinY + hr * 0.5);
      ctx.stroke();
      // Bib
      ctx.strokeStyle = "#4466aa";
      ctx.fillStyle = "#6688cc";
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.roundRect(cx - strapW * 0.8, chinY, strapW * 1.6, hr * 0.45, size * 0.02);
      ctx.fill(); ctx.stroke();
      break;
    }
  }
}

// ── Ears (5 frames) ──────────────────────────────────────────────────────────

function drawEars(ctx: CanvasRenderingContext2D, frameIdx: number, size: number) {
  const { cx, cy, hr } = hc(size);
  const lw = size * 0.025;
  ctx.strokeStyle = CAT_STROKE;
  ctx.fillStyle = CAT_FILL;
  ctx.lineWidth = lw;

  // Ear positions: left ~(-0.55*hr, -0.65*hr) from head center; right mirrored
  const ex = hr * 0.55; // horizontal offset from cx
  const ey = cy - hr * 0.65; // vertical base of ears

  switch (frameIdx) {
    case 0: { // Pointed triangle cat ears
      const ew = hr * 0.35, eh = hr * 0.5;
      [[cx - ex, ey], [cx + ex, ey]].forEach(([bx, by]) => {
        ctx.beginPath();
        ctx.moveTo(bx - ew, by + eh * 0.3);
        ctx.lineTo(bx, by - eh);
        ctx.lineTo(bx + ew, by + eh * 0.3);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Inner ear pink
        ctx.fillStyle = "#ffbbcc";
        ctx.beginPath();
        ctx.moveTo(bx - ew * 0.5, by + eh * 0.25);
        ctx.lineTo(bx, by - eh * 0.65);
        ctx.lineTo(bx + ew * 0.5, by + eh * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = CAT_FILL;
      });
      break;
    }
    case 1: { // Round ears
      const er = hr * 0.27;
      [cx - ex, cx + ex].forEach(bx => {
        ctx.beginPath();
        ctx.arc(bx, ey, er, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffbbcc";
        ctx.beginPath();
        ctx.arc(bx, ey, er * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = CAT_FILL;
      });
      break;
    }
    case 2: { // Floppy ears (larger, hang down from sides)
      const fex = hr * 0.82, fey = cy - hr * 0.1;
      const fw = hr * 0.28, fh = hr * 0.6;
      [cx - fex, cx + fex].forEach((bx, i) => {
        ctx.beginPath();
        ctx.ellipse(
          bx + (i === 0 ? -fw * 0.3 : fw * 0.3),
          fey + fh * 0.3,
          fw, fh, (i === 0 ? -0.2 : 0.2), 0, Math.PI * 2
        );
        ctx.fill(); ctx.stroke();
      });
      break;
    }
    case 3: { // Wide/bunny ears (tall and narrow)
      const bex = hr * 0.42;
      const bw = hr * 0.18, bh = hr * 0.72;
      [cx - bex, cx + bex].forEach(bx => {
        ctx.beginPath();
        ctx.ellipse(bx, ey - bh * 0.3, bw, bh, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffbbcc";
        ctx.beginPath();
        ctx.ellipse(bx, ey - bh * 0.3, bw * 0.5, bh * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = CAT_FILL;
      });
      break;
    }
    case 4: { // Tiny nub ears
      const nr = hr * 0.15;
      [cx - ex * 0.9, cx + ex * 0.9].forEach(bx => {
        ctx.beginPath();
        ctx.arc(bx, ey + nr, nr, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      });
      break;
    }
  }
}

// ── Nose + whiskers (4 frames) ───────────────────────────────────────────────

function drawNoseWhiskers(ctx: CanvasRenderingContext2D, frameIdx: number, size: number) {
  const { cx, cy } = hc(size);
  const lw = size * 0.02;
  ctx.strokeStyle = CAT_STROKE;
  ctx.lineWidth = lw;

  const nx = cx, ny = cy + size * 0.02; // nose center

  function drawWhiskers(len: number, count: number) {
    const spread = size * 0.04;
    ctx.lineWidth = size * 0.012;
    ctx.strokeStyle = "#888888";
    for (let i = 0; i < count; i++) {
      const offsetY = (i - (count - 1) / 2) * spread;
      // Left whisker
      ctx.beginPath();
      ctx.moveTo(nx - size * 0.04, ny + offsetY);
      ctx.lineTo(nx - size * 0.04 - len, ny + offsetY - size * 0.015 * (i - (count - 1) / 2));
      ctx.stroke();
      // Right whisker
      ctx.beginPath();
      ctx.moveTo(nx + size * 0.04, ny + offsetY);
      ctx.lineTo(nx + size * 0.04 + len, ny + offsetY - size * 0.015 * (i - (count - 1) / 2));
      ctx.stroke();
    }
    ctx.strokeStyle = CAT_STROKE;
    ctx.lineWidth = lw;
  }

  switch (frameIdx) {
    case 0: { // Dot nose + 3 whiskers each side
      drawWhiskers(size * 0.1, 3);
      ctx.fillStyle = "#cc6688";
      ctx.beginPath();
      ctx.arc(nx, ny, size * 0.025, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 1: { // Triangle nose + long whiskers
      drawWhiskers(size * 0.13, 3);
      ctx.fillStyle = "#cc6688";
      ctx.beginPath();
      ctx.moveTo(nx, ny - size * 0.02);
      ctx.lineTo(nx - size * 0.025, ny + size * 0.02);
      ctx.lineTo(nx + size * 0.025, ny + size * 0.02);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 2: { // Tiny dot + short whiskers
      drawWhiskers(size * 0.06, 2);
      ctx.fillStyle = "#cc6688";
      ctx.beginPath();
      ctx.arc(nx, ny, size * 0.015, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 3: { // Triangle nose, no whiskers
      ctx.fillStyle = "#cc6688";
      ctx.beginPath();
      ctx.moveTo(nx, ny - size * 0.025);
      ctx.lineTo(nx - size * 0.03, ny + size * 0.025);
      ctx.lineTo(nx + size * 0.03, ny + size * 0.025);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

// ── Mouth (5 frames) ─────────────────────────────────────────────────────────

function drawMouth(ctx: CanvasRenderingContext2D, frameIdx: number, size: number) {
  const { cx, cy, hr } = hc(size);
  const lw = size * 0.022;
  ctx.strokeStyle = CAT_STROKE;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";

  const mx = cx, my = cy + hr * 0.32;

  switch (frameIdx) {
    case 0: { // Simple smile
      ctx.beginPath();
      ctx.arc(mx, my - size * 0.01, size * 0.06, 0.1, Math.PI - 0.1);
      ctx.stroke();
      break;
    }
    case 1: { // Big open grin
      ctx.fillStyle = "#cc3333";
      ctx.beginPath();
      ctx.arc(mx, my, size * 0.09, 0.05, Math.PI - 0.05);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(mx, my, size * 0.075, 0.15, Math.PI - 0.15);
      ctx.fill();
      break;
    }
    case 2: { // Grumpy slight frown
      ctx.beginPath();
      ctx.arc(mx, my + size * 0.04, size * 0.06, Math.PI + 0.15, -0.15);
      ctx.stroke();
      break;
    }
    case 3: { // Surprised O
      ctx.beginPath();
      ctx.ellipse(mx, my, size * 0.04, size * 0.055, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 4: { // Tongue out
      ctx.beginPath();
      ctx.arc(mx, my - size * 0.01, size * 0.07, 0.1, Math.PI - 0.1);
      ctx.stroke();
      ctx.fillStyle = "#ee6688";
      ctx.beginPath();
      ctx.ellipse(mx, my + size * 0.04, size * 0.035, size * 0.05, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
  }
  ctx.lineCap = "butt";
}

// ── Eyes (6 frames) ──────────────────────────────────────────────────────────

function drawEyes(ctx: CanvasRenderingContext2D, frameIdx: number, size: number) {
  const { cx, cy, hr } = hc(size);
  const lw = size * 0.022;
  ctx.strokeStyle = CAT_STROKE;
  ctx.lineWidth = lw;

  const ey = cy - hr * 0.2;
  const ex = hr * 0.38;
  const er = size * 0.06; // eye radius

  function forEachEye(fn: (eyeX: number) => void) {
    fn(cx - ex);
    fn(cx + ex);
  }

  switch (frameIdx) {
    case 0: { // Circle eyes
      forEachEye(eyeX => {
        ctx.fillStyle = "#444444";
        ctx.beginPath();
        ctx.arc(eyeX, ey, er, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(eyeX + er * 0.3, ey - er * 0.3, er * 0.3, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    case 1: { // Star / sparkle eyes
      forEachEye(eyeX => {
        ctx.strokeStyle = "#ffaa00";
        ctx.lineWidth = lw * 1.3;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(eyeX, ey);
          ctx.lineTo(eyeX + Math.cos(angle) * er * 1.1, ey + Math.sin(angle) * er * 1.1);
          ctx.stroke();
        }
        ctx.fillStyle = "#ffcc33";
        ctx.beginPath();
        ctx.arc(eyeX, ey, er * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = CAT_STROKE;
        ctx.lineWidth = lw;
      });
      break;
    }
    case 2: { // Heart eyes
      forEachEye(eyeX => {
        ctx.fillStyle = "#ee3366";
        const hs = er;
        ctx.beginPath();
        ctx.moveTo(eyeX, ey + hs * 0.6);
        ctx.bezierCurveTo(eyeX - hs * 1.1, ey - hs * 0.2, eyeX - hs * 1.1, ey - hs * 1.0, eyeX, ey - hs * 0.4);
        ctx.bezierCurveTo(eyeX + hs * 1.1, ey - hs * 1.0, eyeX + hs * 1.1, ey - hs * 0.2, eyeX, ey + hs * 0.6);
        ctx.fill();
      });
      break;
    }
    case 3: { // Sleepy (half-closed)
      forEachEye(eyeX => {
        ctx.fillStyle = "#444444";
        ctx.beginPath();
        ctx.arc(eyeX, ey, er, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = CAT_FILL;
        ctx.fillRect(eyeX - er * 1.2, ey - er * 1.2, er * 2.4, er * 1.05);
      });
      break;
    }
    case 4: { // Huge eyes
      const bigR = er * 1.7;
      forEachEye(eyeX => {
        ctx.fillStyle = "#ddeeff";
        ctx.beginPath();
        ctx.arc(eyeX, ey, bigR, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#2244aa";
        ctx.beginPath();
        ctx.arc(eyeX - bigR * 0.1, ey + bigR * 0.05, bigR * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111111";
        ctx.beginPath();
        ctx.arc(eyeX - bigR * 0.1, ey + bigR * 0.05, bigR * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(eyeX + bigR * 0.2, ey - bigR * 0.2, bigR * 0.18, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    case 5: { // Dot eyes
      forEachEye(eyeX => {
        ctx.fillStyle = CAT_STROKE;
        ctx.beginPath();
        ctx.arc(eyeX, ey, er * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
  }
}

// ── Glasses (5 frames) ───────────────────────────────────────────────────────

function drawGlasses(ctx: CanvasRenderingContext2D, frameIdx: number, size: number) {
  if (frameIdx === 0) return; // none
  const { cx, cy, hr } = hc(size);
  const lw = size * 0.02;
  ctx.strokeStyle = CAT_STROKE;
  ctx.lineWidth = lw;

  const ey = cy - hr * 0.2;
  const ex = hr * 0.38;
  const er = size * 0.07;

  switch (frameIdx) {
    case 1: { // Round glasses
      [cx - ex, cx + ex].forEach(gx => {
        ctx.beginPath();
        ctx.arc(gx, ey, er, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(cx - ex + er, ey);
      ctx.lineTo(cx + ex - er, ey);
      ctx.stroke();
      break;
    }
    case 2: { // Square glasses
      [cx - ex, cx + ex].forEach(gx => {
        ctx.strokeRect(gx - er, ey - er * 0.8, er * 2, er * 1.6);
      });
      ctx.beginPath();
      ctx.moveTo(cx - ex + er, ey);
      ctx.lineTo(cx + ex - er, ey);
      ctx.stroke();
      break;
    }
    case 3: { // Sunglasses (filled dark)
      const gw = hr * 0.55, gh = er * 0.75;
      [cx - ex, cx + ex].forEach(gx => {
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.beginPath();
        ctx.roundRect(gx - gw * 0.5, ey - gh, gw, gh * 2, size * 0.02);
        ctx.fill(); ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(cx - ex + gw * 0.5, ey);
      ctx.lineTo(cx + ex - gw * 0.5, ey);
      ctx.stroke();
      break;
    }
    case 4: { // Heart glasses
      ctx.strokeStyle = "#dd3366";
      ctx.lineWidth = lw;
      [cx - ex, cx + ex].forEach(gx => {
        ctx.fillStyle = "rgba(255,100,130,0.3)";
        ctx.beginPath();
        ctx.moveTo(gx, ey + er * 0.6);
        ctx.bezierCurveTo(gx - er * 1.1, ey - er * 0.1, gx - er * 1.1, ey - er * 0.9, gx, ey - er * 0.35);
        ctx.bezierCurveTo(gx + er * 1.1, ey - er * 0.9, gx + er * 1.1, ey - er * 0.1, gx, ey + er * 0.6);
        ctx.fill(); ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(cx - ex + er * 0.7, ey - er * 0.1);
      ctx.lineTo(cx + ex - er * 0.7, ey - er * 0.1);
      ctx.stroke();
      ctx.strokeStyle = CAT_STROKE;
      break;
    }
  }
}

// ── Necklace (5 frames) ──────────────────────────────────────────────────────

function drawNecklace(ctx: CanvasRenderingContext2D, frameIdx: number, size: number) {
  if (frameIdx === 0) return; // none
  const { cx, cy, hr } = hc(size);
  const lw = size * 0.022;
  ctx.strokeStyle = CAT_STROKE;
  ctx.lineWidth = lw;

  const ny = cy + hr * 0.72; // necklace y position (around chin/neck)

  switch (frameIdx) {
    case 1: { // Simple collar band
      ctx.strokeStyle = "#cc4400";
      ctx.lineWidth = size * 0.028;
      ctx.beginPath();
      ctx.arc(cx, cy, hr * 0.83, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();
      ctx.strokeStyle = CAT_STROKE;
      ctx.lineWidth = lw;
      break;
    }
    case 2: { // Bead necklace
      ctx.fillStyle = "#8844cc";
      const count = 9, radius = hr * 0.78;
      for (let i = 0; i < count; i++) {
        const angle = Math.PI * 0.2 + (i / (count - 1)) * Math.PI * 0.6;
        const bx = cx + Math.cos(angle) * radius;
        const byd = cy + Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.arc(bx, byd, size * 0.022, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 3: { // Bow tie at neck
      ctx.fillStyle = "#ee4488";
      ctx.strokeStyle = "#cc0066";
      ctx.lineWidth = size * 0.015;
      const bw = hr * 0.2, bh = hr * 0.13;
      [[cx, ny]].forEach(([bx, by]) => {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - bw, by - bh);
        ctx.lineTo(bx - bw, by + bh);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + bw, by - bh);
        ctx.lineTo(bx + bw, by + bh);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ff88cc";
        ctx.beginPath();
        ctx.arc(bx, by, bw * 0.28, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.strokeStyle = CAT_STROKE;
      ctx.lineWidth = lw;
      break;
    }
    case 4: { // Star pendant
      ctx.strokeStyle = "#aabb00";
      ctx.fillStyle = "#ddee00";
      ctx.lineWidth = size * 0.015;
      // Chain arc
      ctx.beginPath();
      ctx.arc(cx, cy, hr * 0.78, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      // Star at bottom of chain
      const sp = { x: cx, y: ny + size * 0.015 };
      const sr = size * 0.03;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const innerAngle = outerAngle + Math.PI / 5;
        if (i === 0) ctx.moveTo(sp.x + Math.cos(outerAngle) * sr, sp.y + Math.sin(outerAngle) * sr);
        else ctx.lineTo(sp.x + Math.cos(outerAngle) * sr, sp.y + Math.sin(outerAngle) * sr);
        ctx.lineTo(sp.x + Math.cos(innerAngle) * sr * 0.4, sp.y + Math.sin(innerAngle) * sr * 0.4);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = CAT_STROKE;
      ctx.lineWidth = lw;
      break;
    }
  }
}

// ── Hat (6 frames) ───────────────────────────────────────────────────────────

function drawHat(ctx: CanvasRenderingContext2D, frameIdx: number, size: number) {
  if (frameIdx === 0) return; // none
  const { cx, cy, hr } = hc(size);
  const lw = size * 0.025;
  ctx.strokeStyle = CAT_STROKE;
  ctx.fillStyle = CAT_FILL;
  ctx.lineWidth = lw;

  const hatBaseY = cy - hr * 0.82; // where hat meets the head

  switch (frameIdx) {
    case 1: { // Baseball cap
      ctx.fillStyle = "#cc3333";
      const brimLeft = cx - hr * 0.85, brimRight = cx + hr * 0.85;
      const capTop = hatBaseY - hr * 0.55;
      // Cap crown
      ctx.beginPath();
      ctx.ellipse(cx, hatBaseY, hr * 0.75, hr * 0.2, 0, Math.PI, 0);
      ctx.lineTo(cx + hr * 0.75, hatBaseY);
      ctx.bezierCurveTo(cx + hr * 0.7, capTop, cx - hr * 0.7, capTop, cx - hr * 0.75, hatBaseY);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Brim
      ctx.beginPath();
      ctx.ellipse(cx + hr * 0.2, hatBaseY, hr * 0.65, hr * 0.12, -0.15, 0, Math.PI);
      ctx.fill(); ctx.stroke();
      void brimLeft; void brimRight; // not used directly but logically part of layout
      break;
    }
    case 2: { // Wizard hat
      ctx.fillStyle = "#443388";
      const wbrimW = hr * 0.95;
      // Brim
      ctx.beginPath();
      ctx.ellipse(cx, hatBaseY, wbrimW, hr * 0.13, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Cone
      ctx.beginPath();
      ctx.moveTo(cx - wbrimW * 0.6, hatBaseY);
      ctx.lineTo(cx, cy - hr * 1.75);
      ctx.lineTo(cx + wbrimW * 0.6, hatBaseY);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Stars on cone
      ctx.fillStyle = "#ffdd00";
      [[cx - hr * 0.15, hatBaseY - hr * 0.55], [cx + hr * 0.1, hatBaseY - hr * 0.9]].forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.022, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    case 3: { // Crown
      ctx.fillStyle = "#ddaa00";
      ctx.strokeStyle = "#886600";
      const cw = hr * 0.9, ch = hr * 0.5, teeth = 4;
      const toothW = (cw * 2) / (teeth * 2 - 1);
      // Crown base band
      ctx.beginPath();
      ctx.rect(cx - cw, hatBaseY - ch * 0.45, cw * 2, ch * 0.45);
      ctx.fill(); ctx.stroke();
      // Crown teeth
      ctx.beginPath();
      for (let i = 0; i < teeth; i++) {
        const tx = cx - cw + i * toothW * 2;
        ctx.moveTo(tx, hatBaseY - ch * 0.45);
        ctx.lineTo(tx, hatBaseY - ch);
        ctx.lineTo(tx + toothW, hatBaseY - ch);
        ctx.lineTo(tx + toothW, hatBaseY - ch * 0.45);
      }
      ctx.stroke();
      // Gems
      ["#ff4444", "#4444ff", "#44ff44", "#ff44ff"].forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx - cw * 0.6 + i * cw * 0.4, hatBaseY - ch * 0.22, size * 0.02, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.strokeStyle = CAT_STROKE;
      ctx.lineWidth = lw;
      break;
    }
    case 4: { // Beanie
      ctx.fillStyle = "#447799";
      const br = hr * 0.8;
      // Main dome
      ctx.beginPath();
      ctx.arc(cx, hatBaseY - br * 0.3, br, Math.PI, 0);
      ctx.lineTo(cx + br, hatBaseY - br * 0.3);
      ctx.arc(cx, hatBaseY - br * 0.3, br, 0, Math.PI);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Ribbed band
      ctx.fillStyle = "#335577";
      ctx.fillRect(cx - br, hatBaseY - size * 0.04 - br * 0.3, br * 2, size * 0.04);
      ctx.strokeRect(cx - br, hatBaseY - size * 0.04 - br * 0.3, br * 2, size * 0.04);
      // Pom pom
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, hatBaseY - br * 1.05, size * 0.04, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 5: { // Top hat
      ctx.fillStyle = "#222222";
      const tw = hr * 0.65, th = hr * 0.85;
      // Brim
      ctx.fillRect(cx - hr * 0.92, hatBaseY - size * 0.018, hr * 1.84, size * 0.035);
      ctx.strokeRect(cx - hr * 0.92, hatBaseY - size * 0.018, hr * 1.84, size * 0.035);
      // Crown
      ctx.fillRect(cx - tw, hatBaseY - th - size * 0.018, tw * 2, th);
      ctx.strokeRect(cx - tw, hatBaseY - th - size * 0.018, tw * 2, th);
      // Hat band
      ctx.fillStyle = "#cc4400";
      ctx.fillRect(cx - tw, hatBaseY - th * 0.15 - size * 0.018, tw * 2, th * 0.15);
      break;
    }
  }
}

// ── Held item (5 frames) ─────────────────────────────────────────────────────

function drawHeldItem(ctx: CanvasRenderingContext2D, frameIdx: number, size: number) {
  if (frameIdx === 0) return; // none
  const { cx, cy, hr } = hc(size);
  const lw = size * 0.02;
  ctx.strokeStyle = CAT_STROKE;
  ctx.lineWidth = lw;

  // Held item positioned to the right of the body, lower area
  const ix = cx + hr * 1.1;
  const iy = cy + hr * 0.5;

  switch (frameIdx) {
    case 1: { // Magic wand
      ctx.strokeStyle = "#884400";
      ctx.lineWidth = size * 0.018;
      ctx.beginPath();
      ctx.moveTo(ix + hr * 0.3, iy - hr * 0.5);
      ctx.lineTo(ix - hr * 0.1, iy + hr * 0.4);
      ctx.stroke();
      // Star tip
      ctx.fillStyle = "#ffdd00";
      ctx.strokeStyle = CAT_STROKE;
      ctx.lineWidth = lw;
      const sx = ix + hr * 0.3, sy = iy - hr * 0.5;
      const sr = size * 0.04;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const b = a + Math.PI / 5;
        if (i === 0) ctx.moveTo(sx + Math.cos(a) * sr, sy + Math.sin(a) * sr);
        else ctx.lineTo(sx + Math.cos(a) * sr, sy + Math.sin(a) * sr);
        ctx.lineTo(sx + Math.cos(b) * sr * 0.4, sy + Math.sin(b) * sr * 0.4);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }
    case 2: { // Flower
      const stem_x = ix, stem_top = iy - hr * 0.5, stem_bot = iy + hr * 0.35;
      ctx.strokeStyle = "#228833";
      ctx.lineWidth = size * 0.018;
      ctx.beginPath();
      ctx.moveTo(stem_x, stem_top);
      ctx.lineTo(stem_x, stem_bot);
      ctx.stroke();
      // Petals
      const petalColors = ["#ffaacc", "#ffcc44", "#aaddff", "#ffaacc", "#ffffaa"];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const px = stem_x + Math.cos(a) * size * 0.04;
        const py = stem_top + Math.sin(a) * size * 0.04;
        ctx.fillStyle = petalColors[i];
        ctx.beginPath();
        ctx.arc(px, py, size * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      // Center
      ctx.fillStyle = "#ffdd00";
      ctx.strokeStyle = CAT_STROKE;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(stem_x, stem_top, size * 0.025, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 3: { // Sword
      ctx.fillStyle = "#aabbcc";
      ctx.strokeStyle = "#667788";
      ctx.lineWidth = size * 0.012;
      const blade_top = iy - hr * 0.7, blade_bot = iy + hr * 0.2;
      const blade_w = size * 0.025;
      // Blade
      ctx.beginPath();
      ctx.moveTo(ix - blade_w, blade_bot);
      ctx.lineTo(ix, blade_top);
      ctx.lineTo(ix + blade_w, blade_bot);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Guard
      ctx.fillStyle = "#ccaa44";
      ctx.fillRect(ix - size * 0.05, blade_bot - size * 0.018, size * 0.1, size * 0.035);
      ctx.strokeRect(ix - size * 0.05, blade_bot - size * 0.018, size * 0.1, size * 0.035);
      // Handle
      ctx.fillStyle = "#884422";
      ctx.fillRect(ix - size * 0.018, blade_bot + size * 0.018, size * 0.035, hr * 0.35);
      ctx.strokeRect(ix - size * 0.018, blade_bot + size * 0.018, size * 0.035, hr * 0.35);
      ctx.strokeStyle = CAT_STROKE;
      ctx.lineWidth = lw;
      break;
    }
    case 4: { // Heart balloon
      // String
      ctx.strokeStyle = "#888888";
      ctx.lineWidth = size * 0.012;
      ctx.beginPath();
      ctx.moveTo(ix, iy + hr * 0.2);
      ctx.bezierCurveTo(ix - size * 0.03, iy - hr * 0.2, ix + size * 0.03, iy - hr * 0.5, ix, iy - hr * 0.65);
      ctx.stroke();
      // Heart
      ctx.fillStyle = "#ff4466";
      ctx.strokeStyle = CAT_STROKE;
      ctx.lineWidth = lw;
      const hx = ix, hy = iy - hr * 1.1, hs = size * 0.06;
      ctx.beginPath();
      ctx.moveTo(hx, hy + hs * 0.6);
      ctx.bezierCurveTo(hx - hs * 1.1, hy - hs * 0.2, hx - hs * 1.1, hy - hs * 1.0, hx, hy - hs * 0.4);
      ctx.bezierCurveTo(hx + hs * 1.1, hy - hs * 1.0, hx + hs * 1.1, hy - hs * 0.2, hx, hy + hs * 0.6);
      ctx.fill(); ctx.stroke();
      break;
    }
  }
}

// ── Layer definitions ─────────────────────────────────────────────────────────

export const LAYERS: LayerDef[] = [
  {
    key: "background",
    label: "Background",
    names: ["None", "Pink", "Blue", "Yellow", "Green", "Purple"],
    defaultFrameCount: 6,
    drawFrame: drawBackground,
  },
  {
    key: "bodyShape",
    label: "Body Shape",
    names: ["Round", "Square", "Wide", "Tall"],
    defaultFrameCount: 4,
    drawFrame: drawBodyShape,
  },
  {
    key: "bodyOutfit",
    label: "Outfit",
    names: ["Bare", "Collar", "Dress", "Tuxedo", "Overalls"],
    defaultFrameCount: 5,
    drawFrame: drawBodyOutfit,
  },
  {
    key: "ears",
    label: "Ears",
    names: ["Pointed", "Round", "Floppy", "Bunny", "Tiny"],
    defaultFrameCount: 5,
    drawFrame: drawEars,
  },
  {
    key: "noseWhiskers",
    label: "Nose & Whiskers",
    names: ["Dot + Whiskers", "Triangle + Long", "Tiny + Short", "Triangle Only"],
    defaultFrameCount: 4,
    drawFrame: drawNoseWhiskers,
  },
  {
    key: "mouth",
    label: "Mouth",
    names: ["Smile", "Grin", "Grumpy", "Surprised", "Tongue"],
    defaultFrameCount: 5,
    drawFrame: drawMouth,
  },
  {
    key: "eyes",
    label: "Eyes",
    names: ["Circles", "Stars", "Hearts", "Sleepy", "Huge", "Dots"],
    defaultFrameCount: 6,
    drawFrame: drawEyes,
  },
  {
    key: "glasses",
    label: "Glasses",
    names: ["None", "Round", "Square", "Sunglasses", "Hearts"],
    defaultFrameCount: 5,
    drawFrame: drawGlasses,
  },
  {
    key: "necklace",
    label: "Necklace",
    names: ["None", "Collar", "Beads", "Bow Tie", "Star Pendant"],
    defaultFrameCount: 5,
    drawFrame: drawNecklace,
  },
  {
    key: "hat",
    label: "Hat",
    names: ["None", "Baseball Cap", "Wizard Hat", "Crown", "Beanie", "Top Hat"],
    defaultFrameCount: 6,
    drawFrame: drawHat,
  },
  {
    key: "heldItem",
    label: "Held Item",
    names: ["None", "Wand", "Flower", "Sword", "Heart Balloon"],
    defaultFrameCount: 5,
    drawFrame: drawHeldItem,
  },
];
