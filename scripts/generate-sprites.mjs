// scripts/generate-sprites.mjs
// Run: node scripts/generate-sprites.mjs
// Outputs PNGs to public/sprites/

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'sprites');
mkdirSync(OUT, { recursive: true });

// ── CRC32 (needed for PNG chunks) ──────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(data.length);
  const payload = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(payload));
  return Buffer.concat([lenBuf, payload, crcBuf]);
}

function writePng(w, h, pixels, outPath) {
  // pixels: Buffer of length w*h*4 (RGBA)
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  // Filter rows (type 0 = None)
  const rowBytes = w * 4;
  const raw = Buffer.allocUnsafe(h * (rowBytes + 1));
  for (let y = 0; y < h; y++) {
    raw[y*(rowBytes+1)] = 0; // filter type None
    pixels.copy(raw, y*(rowBytes+1)+1, y*rowBytes, (y+1)*rowBytes);
  }
  const compressed = deflateSync(raw);
  writeFileSync(outPath, Buffer.concat([sig, pngChunk('IHDR',ihdr), pngChunk('IDAT',compressed), pngChunk('IEND',Buffer.alloc(0))]));
  console.log(`wrote ${outPath}`);
}

// ── Mini canvas API ────────────────────────────────────────────────────────
class Canvas {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.data = Buffer.alloc(w * h * 4, 0); // all transparent
  }
  px(x, y, r, g, b, a=255) {
    x=Math.round(x); y=Math.round(y);
    if (x<0||x>=this.w||y<0||y>=this.h) return;
    const i=(y*this.w+x)*4; this.data[i]=r; this.data[i+1]=g; this.data[i+2]=b; this.data[i+3]=a;
  }
  rect(x,y,w,h,r,g,b,a=255) { for(let dy=0;dy<h;dy++) for(let dx=0;dx<w;dx++) this.px(x+dx,y+dy,r,g,b,a); }
  circle(cx,cy,radius,r,g,b,a=255) {
    for(let dy=-radius;dy<=radius;dy++) for(let dx=-radius;dx<=radius;dx++)
      if(dx*dx+dy*dy<=radius*radius) this.px(cx+dx,cy+dy,r,g,b,a);
  }
  save(name) { writePng(this.w, this.h, this.data, join(OUT, name)); }
}

// ── Sprites (all dimensions doubled: 32x32→64x64, 24x48→48x96, 16x16→32x32)

// Enemy type 0 (red grunt) - 64x64
{
  const c = new Canvas(64,64);
  // Body
  c.rect(16,20,32,28,180,40,0);
  // Head
  c.rect(20,8,24,20,200,120,80);
  // Eyes
  c.rect(24,14,6,6,255,0,0); c.rect(34,14,6,6,255,0,0);
  // Health bar base (green, 100%)
  c.rect(8,2,48,4,0,200,0);
  c.save('enemy-0.png');
}

// Enemy type 1 (dark maroon sniper) - 64x64
{
  const c = new Canvas(64,64);
  c.rect(18,20,28,28,130,30,30);
  c.rect(22,8,20,20,160,90,60);
  c.rect(26,14,4,6,255,80,0); c.rect(34,14,4,6,255,80,0);
  c.rect(8,2,48,4,0,200,0);
  c.save('enemy-1.png');
}

// Enemy type 2 (orange fast) - 64x64
{
  const c = new Canvas(64,64);
  c.rect(14,24,36,24,200,100,0);
  c.rect(20,10,24,20,220,140,80);
  c.rect(24,16,6,6,255,200,0); c.rect(34,16,6,6,255,200,0);
  c.rect(8,2,48,4,0,200,0);
  c.save('enemy-2.png');
}

// Enemy dead (any type) - 64x64 — a crumpled heap
{
  const c = new Canvas(64,64);
  c.rect(8,40,48,16,100,30,0);
  c.rect(12,48,40,8,70,20,0);
  c.rect(24,36,16,12,140,60,20);
  c.save('enemy-dead.png');
}

// Target dummy (type 3) - 64x64 — bullseye poster
{
  const c = new Canvas(64,64);
  // Background poster
  c.rect(4,4,56,56,200,180,140);
  // Bullseye rings
  c.circle(32,32,24,200,180,140);
  c.circle(32,32,20,220,50,30);
  c.circle(32,32,14,240,230,200);
  c.circle(32,32,8,220,50,30);
  c.circle(32,32,4,255,30,10);
  // Health bar
  c.rect(8,2,48,4,0,200,0);
  c.save('target-dummy.png');
}

// Target dummy dead - 64x64
{
  const c = new Canvas(64,64);
  c.rect(8,40,48,16,140,100,60);
  c.rect(12,48,40,8,100,70,40);
  // Collapsed poster scraps
  c.rect(16,32,24,12,180,160,120);
  c.save('target-dummy-dead.png');
}

// Health pickup - 64x64 — green cross
{
  const c = new Canvas(64,64);
  c.circle(32,32,24,0,100,0,180);
  c.rect(20,26,24,12,0,220,60);
  c.rect(26,20,12,24,0,220,60);
  c.save('pickup-health.png');
}

// Ammo pickup - 64x64 — orange bullet cluster
{
  const c = new Canvas(64,64);
  c.circle(32,32,24,80,50,0,180);
  c.rect(22,16,8,32,200,140,0);
  c.rect(34,16,8,32,200,140,0);
  c.rect(20,44,24,8,160,100,0);
  c.save('pickup-ammo.png');
}

// Gun sprite (top-down view) - 48x96 (kept as fallback alias)
{
  const c = new Canvas(48,96);
  // Barrel
  c.rect(18,4,12,48,110,110,110);
  c.rect(20,0,8,8,80,80,80); // muzzle
  // Body/slide
  c.rect(8,44,32,28,90,90,90);
  c.rect(12,48,24,20,60,60,60);
  // Grip
  c.rect(12,68,24,28,50,35,20);
  c.rect(14,70,20,24,35,22,10);
  // Grip texture
  for(let i=0;i<3;i++) c.rect(14+i*6,72,4,20,25,15,5);
  c.save('gun-pistol.png');
}

// Subwoofer — same as pistol, subtle darker chrome
{
  const c = new Canvas(48,96);
  c.rect(18,4,12,48,100,100,108);
  c.rect(20,0,8,8,70,70,80);
  c.rect(8,44,32,28,82,82,92);
  c.rect(12,48,24,20,55,55,65);
  c.rect(12,68,24,28,48,33,18);
  c.rect(14,70,20,24,33,20,8);
  for(let i=0;i<3;i++) c.rect(14+i*6,72,4,20,22,13,4);
  c.save('gun-subwoofer.png');
}

// Claws — wolf paws with 3 curved claws each
{
  const c = new Canvas(48,96);
  // Left arm
  c.rect(0,56,20,40,55,38,18);
  c.rect(2,50,16,12,70,52,26);
  // Left 3 claws (cream-white tapered rects)
  c.rect(3, 22,4,32,235,225,200);
  c.rect(8, 18,4,36,245,235,210);
  c.rect(13,22,4,32,235,225,200);
  // Claw shadow at base
  c.rect(3,50,4,4,38,25,10); c.rect(8,50,4,4,38,25,10); c.rect(13,50,4,4,38,25,10);
  // Right arm (mirrored)
  c.rect(28,56,20,40,55,38,18);
  c.rect(30,50,16,12,70,52,26);
  c.rect(31,22,4,32,235,225,200);
  c.rect(36,18,4,36,245,235,210);
  c.rect(41,22,4,32,235,225,200);
  c.rect(31,50,4,4,38,25,10); c.rect(36,50,4,4,38,25,10); c.rect(41,50,4,4,38,25,10);
  c.save('gun-claws.png');
}

// Woofer — beefier auto pistol with banana clip
{
  const c = new Canvas(48,96);
  c.rect(16,2,16,52,95,95,95);
  c.rect(18,0,12,8,65,65,65);
  c.rect(5,46,38,28,78,78,78);
  c.rect(9,50,30,20,52,52,52);
  // Banana clip
  c.rect(14,70,20,24,55,40,20);
  c.rect(16,88,16,8,42,30,14);
  // Action ridges
  for(let i=0;i<4;i++) c.rect(9,48+i*4,30,2,68,68,68);
  c.save('gun-woofer.png');
}

// Tennis Ball Launcher — stubby tube with ball hopper
{
  const c = new Canvas(48,96);
  // Main tube barrel
  c.rect(8,32,32,40,88,88,78);
  c.rect(12,36,24,32,60,60,50);
  // Barrel rim (front circle approximation)
  c.rect(8,30,32,4,100,100,90);
  // Hopper on top
  c.rect(10,6,28,28,98,93,72);
  c.rect(12,4,24,6,115,110,82);
  // Ball visible in hopper
  c.circle(24,16,9,158,178,48);
  c.circle(24,16,5,198,218,78);
  // Trigger guard
  c.rect(14,68,20,14,72,72,62);
  c.rect(16,70,16,6,52,52,44);
  c.rect(16,76,16,16,56,46,28);
  c.save('gun-tennis.png');
}

// Da Flamthrower — tank + nozzle
{
  const c = new Canvas(48,96);
  // Tank (right side)
  c.rect(28,18,18,60,175,55,18);
  c.rect(30,16,14,6,195,75,28);
  c.rect(30,78,14,4,155,48,14);
  // Lighter highlight on tank
  c.rect(30,22,6,52,215,88,38);
  // Warning stripe
  for(let i=0;i<3;i++) c.rect(28,30+i*12,18,4,200,200,0,170);
  // Hose
  c.rect(18,50,12,6,50,48,42);
  // Nozzle body
  c.rect(4,28,22,14,78,73,62);
  c.rect(4,26,14,18,68,63,54);
  // Muzzle
  c.rect(2,31,6,8,98,88,72);
  // Flame tip
  c.circle(5,35,4,255,175,0);
  c.circle(5,35,2,255,245,100);
  // Grip
  c.rect(18,42,14,30,54,44,28);
  for(let i=0;i<3;i++) c.rect(19+i*4,44,3,24,40,30,18);
  c.save('gun-flamethrower.png');
}

// World weapon pickups (64x64)
// pickup-weapon-woofer
{
  const c = new Canvas(64,64);
  c.circle(32,32,26,95,58,0,210);
  c.circle(32,32,20,120,76,8,230);
  c.rect(16,28,32,8,195,195,178);
  c.rect(28,32,16,12,178,178,158);
  c.rect(30,40,10,8,135,98,55);
  c.save('pickup-weapon-woofer.png');
}
// pickup-weapon-tennis
{
  const c = new Canvas(64,64);
  c.circle(32,32,26,0,95,95,210);
  c.circle(32,32,17,158,178,48);
  c.circle(32,32,11,195,215,78);
  c.rect(15,30,34,4,255,255,255,185);
  c.rect(30,15,4,34,255,255,255,185);
  c.save('pickup-weapon-tennis.png');
}
// pickup-weapon-flamethrower
{
  const c = new Canvas(64,64);
  c.circle(32,32,26,155,28,0,210);
  c.rect(24,18,16,26,255,118,0);
  c.rect(28,12,8,14,255,198,0);
  c.rect(30,8, 4,8, 255,252,145);
  c.rect(22,32,20,8, 195,76,0);
  c.save('pickup-weapon-flamethrower.png');
}
// pickup-bullets (extra bullets)
{
  const c = new Canvas(64,64);
  c.circle(32,32,26,98,58,0,210);
  c.rect(22,14,6,28,195,158,78); c.rect(29,16,6,26,195,158,78); c.rect(36,14,6,28,195,158,78);
  c.rect(22,12,6,4,218,178,98); c.rect(29,14,6,4,218,178,98); c.rect(36,12,6,4,218,178,98);
  c.rect(20,42,24,4,148,98,48);
  c.save('pickup-bullets.png');
}
// pickup-fuel
{
  const c = new Canvas(64,64);
  c.circle(32,32,26,155,28,0,210);
  c.rect(20,20,24,30,215,78,18);
  c.rect(22,16,20,6,195,58,8);
  c.rect(28,12,8,6,175,48,6);
  c.rect(22,48,20,4,175,58,8);
  c.rect(20,30,24,5,255,218,0,175);
  c.save('pickup-fuel.png');
}
// pickup-balls (tennis balls)
{
  const c = new Canvas(64,64);
  c.circle(32,32,26,118,138,18,210);
  c.circle(20,32,9,165,188,55); c.circle(32,20,9,165,188,55); c.circle(44,32,9,165,188,55);
  c.rect(14,31,12,2,255,255,255,165); c.rect(26,19,12,2,255,255,255,165); c.rect(38,31,12,2,255,255,255,165);
  c.save('pickup-balls.png');
}

// projectile-tennis (32x32) — tennis ball
{
  const c = new Canvas(32,32);
  c.circle(16,16,13,162,184,50);
  c.circle(16,16,8,196,218,78);
  c.rect(3,14,26,3,255,255,255,198);
  c.rect(14,3,3,26,255,255,255,198);
  c.save('projectile-tennis.png');
}

// flame-particle (32x32) — orange radial glow
{
  const c = new Canvas(32,32);
  for(let dy=-15;dy<=15;dy++) for(let dx=-15;dx<=15;dx++){
    const r=Math.sqrt(dx*dx+dy*dy); if(r>14) continue;
    const t=1-r/14;
    c.px(16+dx,16+dy, 255, Math.floor(t*t*140+48), 0, Math.floor(t*215));
  }
  c.save('flame-particle.png');
}

// Impact: wall hit — 32x32 grey puff
{
  const c = new Canvas(32,32);
  c.circle(16,16,12,160,160,160,200);
  c.circle(16,16,6,200,200,200,240);
  c.circle(16,16,2,230,230,230,255);
  c.save('impact-wall.png');
}

// Impact: enemy hit — 32x32 red splat
{
  const c = new Canvas(32,32);
  c.circle(16,16,12,180,0,0,220);
  c.circle(16,16,6,220,20,20,240);
  c.circle(16,16,2,255,60,60,255);
  // spatter dots
  [[6,6],[24,8],[8,24],[24,22],[4,16],[26,16],[10,4],[20,28]].forEach(([x,y]) => c.px(x,y,200,0,0,180));
  c.save('impact-enemy.png');
}

console.log('Done — all sprites written to public/sprites/');
