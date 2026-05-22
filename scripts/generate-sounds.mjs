// scripts/generate-sounds.mjs
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'sounds');
mkdirSync(OUT, { recursive: true });

const SR = 8000; // 8 kHz sample rate

function writeWav(samples, outPath) {
  const n = samples.length;
  const buf = Buffer.allocUnsafe(44 + n);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4);
  buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);  // PCM
  buf.writeUInt16LE(1, 22);  // mono
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR, 28); // byte rate
  buf.writeUInt16LE(1, 32);  // block align
  buf.writeUInt16LE(8, 34);  // 8-bit
  buf.write('data', 36); buf.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) {
    buf[44 + i] = Math.max(0, Math.min(255, Math.round(samples[i] * 100 + 128)));
  }
  writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (${n} samples, ${(n/1000).toFixed(1)}KB)`);
}

function gen(dur, fn) {
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = Math.max(-1, Math.min(1, fn(i / SR, i, n)));
  return s;
}

const rng = () => Math.random() * 2 - 1;

// intro: BUH—BUMMM stinger (~1.5s)
writeWav(gen(1.5, (t) => {
  let s = 0;
  if (t < 0.08) s += Math.sin(2*Math.PI*220*t) * Math.exp(-t*25) * 0.9;
  if (t >= 0.18) { const t2=t-0.18; s += (Math.sin(2*Math.PI*110*t2)+Math.sin(2*Math.PI*55*t2)*0.7) * Math.exp(-t2*2.5) * 0.85; }
  return s;
}), join(OUT, 'intro.wav'));

// shoot: punch + noise decay (~0.18s)
writeWav(gen(0.18, (t) => {
  const d = Math.exp(-t*28);
  return (rng()*0.5 + Math.sin(2*Math.PI*90*t)*0.5) * d * 0.9;
}), join(OUT, 'shoot.wav'));

// hit-wall: dull thump (~0.08s)
writeWav(gen(0.08, (t) => {
  return rng() * Math.exp(-t*60) * 0.6;
}), join(OUT, 'hit-wall.wav'));

// hit-enemy: wet thud + high crack (~0.12s)
writeWav(gen(0.12, (t) => {
  const d = Math.exp(-t*40);
  return (Math.sin(2*Math.PI*180*t)*0.5 + rng()*0.5) * d * 0.8;
}), join(OUT, 'hit-enemy.wav'));

// hurt: descending "ugh" (~0.22s)
writeWav(gen(0.22, (t) => {
  const freq = 260 * Math.exp(-t*8);
  return Math.sin(2*Math.PI*freq*t) * Math.exp(-t*12) * 0.8;
}), join(OUT, 'hurt.wav'));

// death: longer descending groan (~0.7s)
writeWav(gen(0.7, (t) => {
  const freq = 160 * Math.exp(-t*1.5);
  const d = Math.exp(-t*4);
  return (Math.sin(2*Math.PI*freq*t)*0.6 + rng()*0.25) * d;
}), join(OUT, 'death.wav'));

// level-complete: 4-note ascending ding (~0.7s)
writeWav(gen(0.7, (t) => {
  const notes = [262, 330, 392, 523];
  const note = notes[Math.min(Math.floor(t*6.5), notes.length-1)];
  const nT = (t*6.5)%1;
  return Math.sin(2*Math.PI*note*t) * Math.exp(-nT*4) * 0.7;
}), join(OUT, 'level-complete.wav'));

// pickup: rising chime (~0.15s)
writeWav(gen(0.15, (t) => {
  const freq = 440 + 660*(1-Math.exp(-t*25));
  return Math.sin(2*Math.PI*freq*t) * Math.exp(-t*10) * 0.65;
}), join(OUT, 'pickup.wav'));

// alert: enemy spots you — short bark (~0.1s)
writeWav(gen(0.1, (t) => {
  const d = Math.exp(-t*20);
  return (rng()*0.4 + Math.sin(2*Math.PI*320*t)*0.6) * d * 0.7;
}), join(OUT, 'alert.wav'));

// shoot-subwoofer: deep sub-bass thud
writeWav(gen(0.14, (t) => {
  const d = Math.exp(-t*32);
  return (rng()*0.4 + Math.sin(2*Math.PI*52*t)*0.7) * d * 0.92;
}), join(OUT, 'shoot-subwoofer.wav'));

// shoot-woofer: lighter faster pop
writeWav(gen(0.08, (t) => {
  const d = Math.exp(-t*50);
  return (rng()*0.5 + Math.sin(2*Math.PI*80*t)*0.5) * d * 0.85;
}), join(OUT, 'shoot-woofer.wav'));

// swipe-claws: whoosh
writeWav(gen(0.18, (t) => {
  const freq = 1200 + 800*(1-t/0.18);
  const d = t < 0.06 ? t/0.06 : Math.exp(-(t-0.06)*18);
  return rng() * d * Math.exp(-Math.pow((freq-1600)/600,2)) * 0.8;
}), join(OUT, 'swipe-claws.wav'));

// hit-claws: meaty thud
writeWav(gen(0.12, (t) => {
  const d = Math.exp(-t*35);
  return (Math.sin(2*Math.PI*110*t)*0.55 + rng()*0.45) * d * 0.85;
}), join(OUT, 'hit-claws.wav'));

// shoot-tennis: thwack/pop
writeWav(gen(0.15, (t) => {
  const d = Math.exp(-t*30);
  return (Math.sin(2*Math.PI*210*t)*0.45 + rng()*0.55) * d * 0.8;
}), join(OUT, 'shoot-tennis.wav'));

// bounce-tennis: short chirp
writeWav(gen(0.09, (t) => {
  const freq = 380 + 240*(1-t/0.09);
  return Math.sin(2*Math.PI*freq*t) * Math.exp(-t*30) * 0.7;
}), join(OUT, 'bounce-tennis.wav'));

// shoot-flamethrower: hiss burst
writeWav(gen(0.22, (t) => {
  const d = t < 0.04 ? t/0.04 : Math.exp(-(t-0.04)*8);
  return rng() * d * 0.75;
}), join(OUT, 'shoot-flamethrower.wav'));

// burning: crackle
writeWav(gen(0.28, (t) => {
  const crackle = Math.sin(t*47*Math.PI*2)*Math.sin(t*113*Math.PI*2);
  return (rng()*0.6 + crackle*0.4) * Math.exp(-t*5) * Math.exp(-Math.pow(t-0.05,2)*80) * 0.7;
}), join(OUT, 'burning.wav'));

// pickup-weapon: 3-note power-up
writeWav(gen(0.42, (t) => {
  const notes = [262, 392, 523];
  const note = notes[Math.min(Math.floor(t*7.5), notes.length-1)];
  const nT = (t*7.5) % 1;
  return Math.sin(2*Math.PI*note*t) * Math.exp(-nT*3) * 0.65;
}), join(OUT, 'pickup-weapon.wav'));

// weapon-switch: quick click
writeWav(gen(0.06, (t) => {
  return (rng()*0.5 + Math.sin(2*Math.PI*180*t)*0.5) * Math.exp(-t*60) * 0.6;
}), join(OUT, 'weapon-switch.wav'));

console.log('Done. All sounds written to public/sounds/');
