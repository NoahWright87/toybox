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

// Gun sprite (top-down view) - 48x96
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
