// Shared map generation module — used by HellMapEditor and Hellzone game

export type Topology = 'drunken' | 'random' | 'linear' | 'grid' | 'spiral';

export interface LayerConfig {
  color: string;
  topo: Topology;
  rooms: number;
  randomStart: boolean;
}

export interface MapGenParams {
  seed: number;
  size: number;
  extraDoorsPct: number;
  roomAvg: number;
  roomVariance: number;
  layers: LayerConfig[];
  secretTreasure: number;
  secretShortcut: number;
}

export interface GenRoom {
  id: number;
  layerIdx: number;
  roomType: string;
  isKey: boolean;
  isSecret: boolean;
  isTrap: boolean;
  isStart: boolean;
  isExit: boolean;
  cx: number;
  cy: number;
  x1: number; y1: number; x2: number; y2: number;
}

export interface GenDoor {
  x: number;
  y: number;
  layerIdx: number;
  isHidden: boolean;
}

export interface MapGenResult {
  seed: number;
  size: number;
  tiles: Uint8Array;
  rooms: GenRoom[];
  doors: GenDoor[];
  layers: LayerConfig[];
}

export const GEN_WALL = 0;
export const GEN_FLOOR = 1;
export const GEN_DOOR = 2;
export const GEN_START = 3;
export const GEN_EXIT = 4;

export const GEN_KEY_COLORS = [
  '#ffffff','#e05040','#e08830','#d4c040','#50a850','#4888e0','#9050d0',
];

// ── Directions: N=0, E=1, S=2, W=3 ──────────────────────────────────────────
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const OPP = [2, 3, 0, 1];

// ── RNG ──────────────────────────────────────────────────────────────────────
function mkRng(s: number) {
  let st = s >>> 0;
  return function () {
    st = (st + 0x6D2B79F5) | 0;
    let t = Math.imul(st ^ (st >>> 15), 1 | st);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function ri(rng: Rng, a: number, b: number) { return a + Math.floor(rng() * (b - a + 1)); }
function pick<T>(rng: Rng, arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }
function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ── Room ──────────────────────────────────────────────────────────────────────
interface Rect { x: number; y: number; w: number; h: number; }

class Room {
  rects: Rect[];
  id = -1;
  layerIdx = 0;
  isKey = false;
  isStart = false;
  isExit = false;
  isSecret = false;
  isTrap = false;
  roomType = 'none';
  floors: Record<string, boolean> = {};
  edges: Array<Array<{x: number; y: number}>> = [[], [], [], []];
  x1 = Infinity; y1 = Infinity; x2 = -Infinity; y2 = -Infinity;
  cx = 0; cy = 0; w = 0; h = 0;

  constructor(rects: Rect[]) {
    this.rects = rects;
    for (const r of rects) {
      for (let fy = r.y; fy < r.y + r.h; fy++) {
        for (let fx = r.x; fx < r.x + r.w; fx++) {
          this.floors[`${fx},${fy}`] = true;
          if (fx < this.x1) this.x1 = fx;
          if (fy < this.y1) this.y1 = fy;
          if (fx + 1 > this.x2) this.x2 = fx + 1;
          if (fy + 1 > this.y2) this.y2 = fy + 1;
        }
      }
    }
    this.w = this.x2 - this.x1;
    this.h = this.y2 - this.y1;
    this.cx = Math.floor((this.x1 + this.x2) / 2);
    this.cy = Math.floor((this.y1 + this.y2) / 2);
    for (let dir = 0; dir < 4; dir++) {
      const horiz = dir === 0 || dir === 2;
      for (const key of Object.keys(this.floors)) {
        const [ex, ey] = key.split(',').map(Number);
        if (this.floors[`${ex + DX[dir]},${ey + DY[dir]}`]) continue;
        const par = horiz
          ? (this.floors[`${ex - 1},${ey}`] || this.floors[`${ex + 1},${ey}`])
          : (this.floors[`${ex},${ey - 1}`] || this.floors[`${ex},${ey + 1}`]);
        if (par) this.edges[dir].push({ x: ex, y: ey });
      }
    }
  }

  isFloor(x: number, y: number) { return !!this.floors[`${x},${y}`]; }

  translate(dx: number, dy: number): Room {
    const nr = this.rects.map(r => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }));
    const room = new Room(nr);
    room.id = this.id;
    room.layerIdx = this.layerIdx;
    return room;
  }

  overlaps(other: Room): boolean {
    for (const a of this.rects)
      for (const b of other.rects)
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) return true;
    return false;
  }

  inBounds(S: number): boolean {
    return this.x1 >= 1 && this.y1 >= 1 && this.x2 <= S - 1 && this.y2 <= S - 1;
  }
}

// ── Shape factories ───────────────────────────────────────────────────────────
const MD = 3;

function mkRect(rng: Rng, minW: number, maxW: number, minH: number, maxH: number): Room {
  return new Room([{
    x: 0, y: 0,
    w: ri(rng, Math.max(MD, minW), Math.max(MD, maxW)),
    h: ri(rng, Math.max(MD, minH), Math.max(MD, maxH)),
  }]);
}

function mkL(rng: Rng, mn: number, mx: number): Room {
  mn = Math.max(MD, mn);
  const aw = ri(rng, mn, mx), ah = ri(rng, mn, mx);
  const bw = ri(rng, mn, Math.max(mn, Math.floor(aw * 0.65)));
  const bh = ri(rng, mn, Math.max(mn, Math.floor(ah * 0.65)));
  const v = ri(rng, 0, 3);
  let rects: Rect[];
  if (v === 0)      rects = [{ x: 0, y: 0, w: aw, h: ah }, { x: 0, y: ah, w: bw, h: bh }];
  else if (v === 1) rects = [{ x: 0, y: 0, w: aw, h: ah }, { x: aw - bw, y: ah, w: bw, h: bh }];
  else if (v === 2) rects = [{ x: 0, y: bh, w: aw, h: ah }, { x: 0, y: 0, w: bw, h: bh }];
  else              rects = [{ x: 0, y: bh, w: aw, h: ah }, { x: aw - bw, y: 0, w: bw, h: bh }];
  return new Room(rects);
}

function mkCross(rng: Rng, mn: number, mx: number): Room {
  mn = Math.max(MD, mn);
  const hw = ri(rng, mn, mx), hh = ri(rng, MD, 4);
  const vw = ri(rng, MD, 4), vh = ri(rng, mn, mx);
  return new Room([
    { x: 0, y: Math.floor(vh / 2) - Math.floor(hh / 2), w: hw, h: hh },
    { x: Math.floor(hw / 2) - Math.floor(vw / 2), y: 0, w: vw, h: vh },
  ]);
}

function smallRoom(rng: Rng): Room { return mkRect(rng, MD, 5, MD, 5); }

function randomRoom(rng: Rng, topo: Topology, dir: number, avg: number, variance: number): Room {
  const mn = Math.max(MD, avg - variance);
  const mx = avg + variance;
  const r = rng();
  if (topo === 'linear') {
    const goVert = dir === 0 || dir === 2;
    const shortMn = MD, shortMx = Math.max(MD + 1, Math.floor(avg * 0.4));
    const longMn = Math.max(MD, avg), longMx = mx + Math.floor(variance / 2);
    if (goVert) return r < 0.8 ? mkRect(rng, shortMn, shortMx, longMn, longMx) : mkRect(rng, shortMn, shortMx, mn, mx);
    else        return r < 0.8 ? mkRect(rng, longMn, longMx, shortMn, shortMx) : mkRect(rng, mn, mx, shortMn, shortMx);
  }
  if (topo === 'grid') return r < 0.65 ? mkRect(rng, mn, mx, mn, mx) : r < 0.85 ? mkL(rng, mn, mx) : mkCross(rng, mn, mx);
  if (topo === 'spiral') {
    const goVert3 = dir === 0 || dir === 2;
    const tall = mkRect(rng, mn, mx, Math.max(mn, avg), mx + 2);
    const wide = mkRect(rng, Math.max(mn, avg), mx + 2, mn, mx);
    return r < 0.35 ? (goVert3 ? tall : wide)
      : r < 0.6 ? (goVert3 ? wide : tall)
      : r < 0.85 ? mkL(rng, mn, Math.max(mx, avg + 3))
      : mkCross(rng, mn, Math.max(mx, avg + 3));
  }
  return r < 0.55 ? mkRect(rng, mn, mx, mn, mx) : r < 0.78 ? mkL(rng, mn, mx) : mkCross(rng, mn, mx);
}

function roomForShape(rng: Rng, category: string, avg: number, variance: number): Room | null {
  const mn = Math.max(MD, avg - variance), mx = avg + variance;
  if (category === 'large_rect') return mkRect(rng, Math.max(MD, avg), mx + 2, Math.max(MD, avg), mx + 2);
  if (category === 'med_rect')   return mkRect(rng, mn, mx, mn, mx);
  if (category === 'small_rect') return mkRect(rng, MD, Math.max(MD, Math.floor(avg * 0.6)), MD, Math.max(MD, Math.floor(avg * 0.6)));
  if (category === 'cross')      return mkCross(rng, mn, mx);
  if (category === 'L')          return mkL(rng, mn, mx);
  if (category === 'corridor_h') return mkRect(rng, Math.max(MD, avg), mx + 4, MD, Math.max(MD, Math.floor(avg * 0.35)));
  if (category === 'corridor_v') return mkRect(rng, MD, Math.max(MD, Math.floor(avg * 0.35)), Math.max(MD, avg), mx + 4);
  return null;
}

// ── Room type definitions ─────────────────────────────────────────────────────
const SHAPES_LARGE_RECT = ['large_rect'];
const SHAPES_ANY_RECT   = ['small_rect', 'med_rect', 'large_rect'];
const SHAPES_SMALL      = ['small_rect'];
const SHAPES_CORRIDOR   = ['corridor_h', 'corridor_v'];
const SHAPES_OPEN       = ['large_rect', 'cross'];

interface RoomTypeDef {
  label: string;
  emoji: string | null;
  cooldown: number;
  minProgress: number;
  maxPerMap: number;
  shapes: string[] | null;
  isTrap: boolean;
  cannotBeAdjacentTo: string[];
  isSecret?: boolean;
}

const ROOM_TYPES: Record<string, RoomTypeDef> = {
  none:            { label: 'filler',          emoji: null,  cooldown: 0,   minProgress: 0,   maxPerMap: -1, shapes: null,            isTrap: false, cannotBeAdjacentTo: [] },
  start:           { label: 'start',           emoji: '🚀',  cooldown: 0,   minProgress: 0,   maxPerMap: 1,  shapes: SHAPES_ANY_RECT, isTrap: false, cannotBeAdjacentTo: ['boss', 'miniboss'] },
  exit:            { label: 'exit',            emoji: '🚪',  cooldown: 0,   minProgress: 0.8, maxPerMap: 1,  shapes: SHAPES_ANY_RECT, isTrap: false, cannotBeAdjacentTo: ['safe', 'weapon'] },
  boss:            { label: 'boss',            emoji: '💀',  cooldown: 100, minProgress: 0.7, maxPerMap: 1,  shapes: SHAPES_LARGE_RECT, isTrap: true, cannotBeAdjacentTo: ['combat', 'safe', 'miniboss', 'boss'] },
  miniboss:        { label: 'mini-boss',       emoji: '👹',  cooldown: 25,  minProgress: 0.4, maxPerMap: -1, shapes: SHAPES_OPEN,    isTrap: true,  cannotBeAdjacentTo: ['boss', 'safe', 'miniboss'] },
  combat:          { label: 'combat',          emoji: '⚔️',  cooldown: 5,   minProgress: 0,   maxPerMap: -1, shapes: SHAPES_OPEN,    isTrap: false, cannotBeAdjacentTo: ['safe'] },
  safe:            { label: 'safe',            emoji: '💊',  cooldown: 15,  minProgress: 0,   maxPerMap: -1, shapes: SHAPES_ANY_RECT, isTrap: false, cannotBeAdjacentTo: ['boss', 'combat', 'miniboss'] },
  weapon:          { label: 'weapon',          emoji: '🔫',  cooldown: 10,  minProgress: 0,   maxPerMap: -1, shapes: SHAPES_ANY_RECT, isTrap: false, cannotBeAdjacentTo: ['treasure'] },
  treasure:        { label: 'treasure',        emoji: '💎',  cooldown: 8,   minProgress: 0,   maxPerMap: -1, shapes: SHAPES_SMALL,   isTrap: false, cannotBeAdjacentTo: ['safe', 'treasure'] },
  key:             { label: 'key',             emoji: '🗝️',  cooldown: 0,   minProgress: 0.5, maxPerMap: 1,  shapes: SHAPES_ANY_RECT, isTrap: false, cannotBeAdjacentTo: [] },
  secret_treasure: { label: 'secret treasure', emoji: '🌟',  cooldown: 0,   minProgress: 0,   maxPerMap: -1, shapes: SHAPES_SMALL,   isTrap: false, cannotBeAdjacentTo: [], isSecret: true },
  secret_shortcut: { label: 'shortcut',        emoji: '⚡',  cooldown: 0,   minProgress: 0,   maxPerMap: -1, shapes: SHAPES_CORRIDOR, isTrap: false, cannotBeAdjacentTo: [], isSecret: true },
};

function roomForType(rng: Rng, typeKey: string, topo: Topology, dir: number, avg: number, variance: number): Room {
  const def = ROOM_TYPES[typeKey];
  if (!def || !def.shapes) return randomRoom(rng, topo, dir, avg, variance);
  let shapes = def.shapes;
  if (shapes === SHAPES_CORRIDOR) {
    shapes = (dir === 0 || dir === 2) ? ['corridor_v'] : ['corridor_h'];
  }
  const cat = shapes[Math.floor(rng() * shapes.length)];
  const room = roomForShape(rng, cat, avg, variance);
  return room || randomRoom(rng, topo, dir, avg, variance);
}

// ── Room type tracker ─────────────────────────────────────────────────────────
class RoomTypeTracker {
  roomsSinceLast: Record<string, number> = {};
  totalPlaced: Record<string, number> = {};
  recentNeighbors: Record<number, string[]> = {};

  constructor() {
    for (const k of Object.keys(ROOM_TYPES)) {
      this.roomsSinceLast[k] = 9999;
      this.totalPlaced[k] = 0;
    }
  }

  tick() {
    for (const k of Object.keys(this.roomsSinceLast)) this.roomsSinceLast[k]++;
  }

  recordPlacement(typeKey: string, room: Room) {
    this.roomsSinceLast[typeKey] = 0;
    this.totalPlaced[typeKey] = (this.totalPlaced[typeKey] || 0) + 1;
    room.roomType = typeKey;
  }

  recordDoor(roomA: Room, roomB: Room) {
    if (!this.recentNeighbors[roomA.id]) this.recentNeighbors[roomA.id] = [];
    if (!this.recentNeighbors[roomB.id]) this.recentNeighbors[roomB.id] = [];
    if (roomA.roomType) this.recentNeighbors[roomB.id].push(roomA.roomType);
    if (roomB.roomType) this.recentNeighbors[roomA.id].push(roomB.roomType);
  }

  eligible(typeKey: string, progress: number, parentRoom: Room | null): boolean {
    const def = ROOM_TYPES[typeKey];
    if (!def) return false;
    if (this.roomsSinceLast[typeKey] < def.cooldown) return false;
    if (progress < def.minProgress) return false;
    if (def.maxPerMap >= 0 && (this.totalPlaced[typeKey] || 0) >= def.maxPerMap) return false;
    if (parentRoom && parentRoom.roomType) {
      const pType = parentRoom.roomType;
      if (def.cannotBeAdjacentTo.indexOf(pType) >= 0) return false;
      const pDef = ROOM_TYPES[pType];
      if (pDef && pDef.cannotBeAdjacentTo.indexOf(typeKey) >= 0) return false;
    }
    return true;
  }

  pickType(rng: Rng, progress: number, parentRoom: Room | null, isFirstRoom: boolean): string {
    if (isFirstRoom) return 'none';
    const reserved = ['start', 'exit', 'key', 'secret_treasure', 'secret_shortcut'];
    const pool: string[] = [];
    for (const k of Object.keys(ROOM_TYPES)) {
      if (reserved.indexOf(k) >= 0) continue;
      if (this.eligible(k, progress, parentRoom)) pool.push(k);
    }
    if (!pool.length) return 'none';
    return pool[Math.floor(rng() * pool.length)];
  }
}

// ── Space scoring ─────────────────────────────────────────────────────────────
function buildOccupied(allRooms: Room[]): Record<string, boolean> {
  const occ: Record<string, boolean> = {};
  for (const room of allRooms)
    for (const k of Object.keys(room.floors)) occ[k] = true;
  return occ;
}

function openDirsSorted(rng: Rng, room: Room, SIZE: number, occ: Record<string, boolean>): number[] {
  const scores = [0, 0, 0, 0];
  const RAY = Math.floor(SIZE * 0.5);
  for (let dir = 0; dir < 4; dir++) {
    const faceTiles = room.edges[dir];
    if (!faceTiles.length) { scores[dir] = 0; continue; }
    for (const ft of faceTiles) {
      const fx = ft.x + DX[dir];
      const fy = ft.y + DY[dir];
      for (let step = 1; step <= RAY; step++) {
        const tx = fx + DX[dir] * (step - 1);
        const ty = fy + DY[dir] * (step - 1);
        if (tx < 1 || tx >= SIZE - 1 || ty < 1 || ty >= SIZE - 1) break;
        if (occ[`${tx},${ty}`]) break;
        scores[dir]++;
      }
    }
  }
  const dirs = [0, 1, 2, 3];
  const noise = [rng() * 0.9, rng() * 0.9, rng() * 0.9, rng() * 0.9];
  dirs.sort((a, b) => (scores[b] + noise[b]) - (scores[a] + noise[a]));
  return dirs;
}

function dirsForRoom(rng: Rng, topo: Topology, room: Room, dirHistory: number[], SIZE: number, occ: Record<string, boolean>): number[] {
  const open = openDirsSorted(rng, room, SIZE, occ);
  if (topo === 'linear') {
    const committed = dirHistory.length ? dirHistory[dirHistory.length - 1] : open[0];
    let committedScore = 0;
    for (const ft of room.edges[committed]) {
      const fx = ft.x + DX[committed];
      const fy = ft.y + DY[committed];
      if (!occ[`${fx},${fy}`] && fx >= 1 && fx < SIZE - 1 && fy >= 1 && fy < SIZE - 1) committedScore++;
    }
    if (committedScore > 0) {
      const others = [0, 1, 2, 3].filter(d => d !== committed);
      return [committed, ...others];
    }
    return open;
  }
  if (topo === 'drunken') {
    const rest = shuffle(rng, [open[1], open[2], open[3]]);
    return rng() < 0.6 ? [open[0], rest[0], rest[1], rest[2]] : [rest[0], open[0], rest[1], rest[2]];
  }
  if (topo === 'spiral') {
    const last = dirHistory.length ? dirHistory[dirHistory.length - 1] : open[0];
    const right = (last + 1) % 4;
    if (open.indexOf(right) <= 1) return [right, last, open[0], (last + 3) % 4, (last + 2) % 4];
    return [open[0], right, last, (last + 3) % 4, (last + 2) % 4];
  }
  if (topo === 'grid') {
    const last2 = dirHistory.length ? dirHistory[dirHistory.length - 1] : open[0];
    return [(last2 + 1) % 4, (last2 + 2) % 4, (last2 + 3) % 4, last2 % 4];
  }
  return shuffle(rng, [0, 1, 2, 3]);
}

// ── tryAttachRoom ─────────────────────────────────────────────────────────────
interface AttachResult { room: Room; dir: number; }

function tryAttachRoom(
  rng: Rng,
  parent: Room,
  dirs: number[],
  layerIdx: number,
  topo: Topology,
  typeKey: string,
  SIZE: number,
  allRooms: Room[],
  occ: Record<string, boolean>,
  placeDoor: (x: number, y: number, layerIdx: number) => void,
  avg: number,
  variance: number,
): AttachResult | null {
  for (const dir of dirs) {
    const edge = parent.edges[dir];
    if (!edge.length) continue;
    const cands = shuffle(rng, edge).slice(0, 8);
    for (const pTile of cands) {
      const doorX = pTile.x + DX[dir], doorY = pTile.y + DY[dir];
      const cAX = doorX + DX[dir], cAY = doorY + DY[dir];
      for (let ai = 0; ai < 4; ai++) {
        const child = ai < 2 ? roomForType(rng, typeKey, topo, dir, avg, variance) : smallRoom(rng);
        child.layerIdx = layerIdx;
        const inward = child.edges[OPP[dir]];
        if (!inward.length) continue;
        const cEdge = pick(rng, inward);
        const placed = child.translate(cAX - cEdge.x, cAY - cEdge.y);
        placed.layerIdx = layerIdx;
        if (!placed.inBounds(SIZE)) continue;
        let bad = false;
        for (const r of allRooms) { if (r.overlaps(placed)) { bad = true; break; } }
        if (bad) continue;
        placed.id = allRooms.length;
        allRooms.push(placed);
        placeDoor(doorX, doorY, layerIdx);
        for (const fk of Object.keys(placed.floors)) occ[fk] = true;
        return { room: placed, dir };
      }
    }
  }
  return null;
}

// ── Main generation ───────────────────────────────────────────────────────────
export function generateMap(params: MapGenParams): MapGenResult {
  const { seed, size: SIZE, extraDoorsPct, roomAvg, roomVariance, layers, secretTreasure, secretShortcut } = params;
  const avg = Math.max(3, roomAvg);
  const variance = Math.max(0, roomVariance);

  const rng = mkRng(seed);
  const tiles = new Uint8Array(SIZE * SIZE); // all GEN_WALL=0 by default
  const allRooms: Room[] = [];
  const genDoors: GenDoor[] = [];

  // Door color tracking: "x,y" -> layerIdx
  const doorLayerMap: Record<string, number> = {};
  const hiddenDoors = new Set<string>();

  function setTile(x: number, y: number, t: number) {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) tiles[y * SIZE + x] = t;
  }

  function paintRoom(room: Room) {
    for (const key of Object.keys(room.floors)) {
      const [x, y] = key.split(',').map(Number);
      const v = room.isStart ? GEN_START : room.isExit ? GEN_EXIT : GEN_FLOOR;
      setTile(x, y, v);
    }
  }

  function placeDoor(x: number, y: number, layerIdx: number) {
    setTile(x, y, GEN_DOOR);
    doorLayerMap[`${x},${y}`] = layerIdx;
  }

  function placeHiddenDoor(x: number, y: number, layerIdx: number) {
    // Hidden doors look like walls in the tile array — stored in genDoors with isHidden=true
    doorLayerMap[`${x},${y}`] = layerIdx;
    hiddenDoors.add(`${x},${y}`);
  }

  function calcStarterPos(topo: Topology, rw: number, rh: number): { sx: number; sy: number } {
    if (topo === 'linear') {
      const edge = ri(rng, 0, 3), margin = 4;
      if (edge === 0) return { sx: Math.floor(SIZE / 2 - rw / 2), sy: margin };
      if (edge === 1) return { sx: SIZE - margin - rw, sy: Math.floor(SIZE / 2 - rh / 2) };
      if (edge === 2) return { sx: Math.floor(SIZE / 2 - rw / 2), sy: SIZE - margin - rh };
      return { sx: margin, sy: Math.floor(SIZE / 2 - rh / 2) };
    }
    return { sx: Math.floor(SIZE / 2 - rw / 2), sy: Math.floor(SIZE / 2 - rh / 2) };
  }

  const tracker = new RoomTypeTracker();
  let dirHistory: number[] = [];
  let growIdx = 0;

  function tryRoom(
    room: Room,
    layerIdx: number,
    occ: Record<string, boolean>,
    layerRooms: Room[],
    forceType?: string,
  ): AttachResult | null {
    const topo = layers[layerIdx].topo;
    const dirs = dirsForRoom(rng, topo, room, dirHistory, SIZE, occ);
    const layerTotal = layers[layerIdx].rooms;
    const progress = layerTotal > 0 ? layerRooms.length / layerTotal : 0;
    const typeKey = forceType || tracker.pickType(rng, progress, room, layerRooms.length === 0);
    const result = tryAttachRoom(rng, room, dirs, layerIdx, topo, typeKey, SIZE, allRooms, occ, placeDoor, avg, variance);
    if (result) {
      tracker.recordPlacement(typeKey, result.room);
      tracker.recordDoor(room, result.room);
      tracker.tick();
    }
    return result;
  }

  // ── Generate layer by layer ─────────────────────────────────────────────────
  let anchorRoom: Room | null = null;

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const ld = layers[layerIdx];
    const layerRooms: Room[] = [];
    dirHistory = [];
    growIdx = 0;
    let keyPlaced = false;
    const keyRoomIdx = ri(rng, Math.floor(ld.rooms * 0.5), ld.rooms - 1);

    if (layerIdx === 0) {
      const sTpl = mkRect(rng, 5, 8, 5, 8);
      const pos = calcStarterPos(ld.topo, sTpl.w, sTpl.h);
      const sRoom = sTpl.translate(pos.sx, pos.sy);
      sRoom.id = allRooms.length;
      sRoom.layerIdx = 0;
      sRoom.isStart = true;
      sRoom.roomType = 'start';
      allRooms.push(sRoom);
      layerRooms.push(sRoom);
      paintRoom(sRoom);
      tracker.recordPlacement('start', sRoom);
      anchorRoom = sRoom;
    } else {
      const prevLayerRooms = allRooms.filter(r => r.layerIdx === layerIdx - 1);
      anchorRoom = ld.randomStart ? pick(rng, prevLayerRooms) : prevLayerRooms[prevLayerRooms.length - 1];
    }

    let stuck = false;
    const safetyMax = 2000;
    let safety = 0;

    while (layerRooms.length < ld.rooms && !stuck && safety < safetyMax) {
      safety++;
      const freshOcc = buildOccupied(allRooms);

      const prevLayerRooms = layerIdx > 0 ? allRooms.filter(r => r.layerIdx === layerIdx - 1) : [];
      let result: AttachResult | null = null;

      if (!result && layerRooms.length > 0) {
        let frontier: Room;
        if (ld.topo === 'random') frontier = pick(rng, layerRooms);
        else if (ld.topo === 'grid') frontier = layerRooms[growIdx % layerRooms.length];
        else frontier = layerRooms[layerRooms.length - 1];
        result = tryRoom(frontier, layerIdx, freshOcc, layerRooms);
      }
      if (!result && layerRooms.length === 0 && anchorRoom) {
        result = tryRoom(anchorRoom, layerIdx, freshOcc, layerRooms);
      }
      if (!result && layerRooms.length > 1) {
        result = tryRoom(layerRooms[layerRooms.length - 2], layerIdx, freshOcc, layerRooms);
      }
      if (!result && layerRooms.length > 0) {
        result = tryRoom(pick(rng, layerRooms), layerIdx, freshOcc, layerRooms);
      }
      if (!result && prevLayerRooms.length > 0) {
        result = tryRoom(pick(rng, prevLayerRooms), layerIdx, freshOcc, layerRooms);
      }
      if (!result && allRooms.length > 0) {
        result = tryRoom(pick(rng, allRooms), layerIdx, freshOcc, layerRooms);
      }
      if (!result) { stuck = true; break; }

      layerRooms.push(result.room);
      dirHistory.push(result.dir);
      if (dirHistory.length > 6) dirHistory.shift();
      growIdx++;
      paintRoom(result.room);

      if (!keyPlaced && layerRooms.length - 1 >= keyRoomIdx && layerIdx < layers.length - 1) {
        result.room.isKey = true;
        result.room.roomType = 'key';
        keyPlaced = true;
      }
    }

    // Fallback key room
    if (!keyPlaced && layerIdx < layers.length - 1 && layerRooms.length > 0) {
      const kr = layerRooms[layerRooms.length - 1];
      if (!kr.isKey) { kr.isKey = true; kr.roomType = 'key'; }
    }

    // Extra doors within layer
    if (extraDoorsPct > 0) {
      for (let i = 0; i < layerRooms.length; i++) {
        for (let j = i + 1; j < layerRooms.length; j++) {
          const a = layerRooms[i], b = layerRooms[j];
          if (a.x1 > b.x2 + 2 || b.x1 > a.x2 + 2 || a.y1 > b.y2 + 2 || b.y1 > a.y2 + 2) continue;
          if (rng() > extraDoorsPct) continue;
          let found = false;
          for (let ed = 0; ed < 4 && !found; ed++) {
            for (const at of a.edges[ed]) {
              if (found) break;
              const wx = at.x + DX[ed], wy = at.y + DY[ed];
              if (b.isFloor(wx + DX[ed], wy + DY[ed]) && tiles[wy * SIZE + wx] === GEN_WALL) {
                placeDoor(wx, wy, layerIdx);
                found = true;
              }
            }
          }
        }
      }
    }
  }

  // ── Mark exit ────────────────────────────────────────────────────────────────
  let exitRoom: Room | null = null;
  let bestDist = 0;
  const lastLayerIdx = layers.length - 1;
  const startRoom = allRooms[0];
  for (const r of allRooms) {
    if (r.isStart || r.isKey || r.roomType === 'boss' || r.roomType === 'miniboss') continue;
    let d = Math.abs(r.cx - startRoom.cx) + Math.abs(r.cy - startRoom.cy);
    if (r.layerIdx === lastLayerIdx) d += 1000;
    if (d > bestDist) { bestDist = d; exitRoom = r; }
  }
  if (exitRoom) {
    exitRoom.isExit = true;
    exitRoom.roomType = 'exit';
    paintRoom(exitRoom);
    tracker.recordPlacement('exit', exitRoom);

    // Boss candidate: door-adjacent to exit
    for (const r of allRooms) {
      if (r === exitRoom || r.isStart || r.isKey) continue;
      if (!tracker.eligible('boss', 1.0, r)) continue;
      let connectedToExit = false;
      for (const dk of Object.keys(doorLayerMap)) {
        const [wx, wy] = dk.split(',').map(Number);
        for (let bd = 0; bd < 4; bd++) {
          if (r.isFloor(wx - DX[bd], wy - DY[bd]) && exitRoom.isFloor(wx + DX[bd], wy + DY[bd])) {
            connectedToExit = true; break;
          }
        }
        if (connectedToExit) break;
      }
      if (connectedToExit) {
        r.roomType = 'boss';
        r.isTrap = true;
        tracker.recordPlacement('boss', r);
        break;
      }
    }
  }

  // ── Secret room pass ─────────────────────────────────────────────────────────
  const secOcc = buildOccupied(allRooms);

  function placeSecrets(count: number, typeKey: string) {
    let placed = 0, attempts = 0;
    const maxAttempts = count * 40;
    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const parent = pick(rng, allRooms);
      if (parent.roomType === 'secret_treasure' || parent.roomType === 'secret_shortcut') continue;
      const dirs2 = shuffle(rng, [0, 1, 2, 3]);
      const secDir = dirs2[0];
      const edge2 = parent.edges[secDir];
      if (!edge2.length) continue;
      const pTile2 = pick(rng, edge2);
      const doorX2 = pTile2.x + DX[secDir], doorY2 = pTile2.y + DY[secDir];
      const cAX2 = doorX2 + DX[secDir], cAY2 = doorY2 + DY[secDir];
      const child2 = roomForType(rng, typeKey, 'random', secDir, Math.max(MD, avg - variance), variance);
      child2.layerIdx = parent.layerIdx;
      const inward2 = child2.edges[OPP[secDir]];
      if (!inward2.length) continue;
      const cEdge2 = pick(rng, inward2);
      const placed3 = child2.translate(cAX2 - cEdge2.x, cAY2 - cEdge2.y);
      placed3.layerIdx = parent.layerIdx;
      if (!placed3.inBounds(SIZE)) continue;
      let bad = false;
      for (const r of allRooms) { if (r.overlaps(placed3)) { bad = true; break; } }
      if (bad) continue;
      placed3.id = allRooms.length;
      placed3.roomType = typeKey;
      placed3.isSecret = true;
      allRooms.push(placed3);
      for (const fk of Object.keys(placed3.floors)) {
        secOcc[fk] = true;
        const [fx, fy] = fk.split(',').map(Number);
        setTile(fx, fy, GEN_FLOOR);
      }
      placeHiddenDoor(doorX2, doorY2, placed3.layerIdx);
      placed++;
    }
  }

  placeSecrets(secretTreasure, 'secret_treasure');
  placeSecrets(secretShortcut, 'secret_shortcut');

  // ── Build door output array ──────────────────────────────────────────────────
  for (const key of Object.keys(doorLayerMap)) {
    const [x, y] = key.split(',').map(Number);
    genDoors.push({ x, y, layerIdx: doorLayerMap[key], isHidden: hiddenDoors.has(key) });
  }

  // ── Build GenRoom output ─────────────────────────────────────────────────────
  const genRooms: GenRoom[] = allRooms.map(r => ({
    id: r.id,
    layerIdx: r.layerIdx,
    roomType: r.roomType,
    isKey: r.isKey,
    isSecret: r.isSecret,
    isTrap: r.isTrap || (r.roomType === 'boss') || (r.roomType === 'miniboss'),
    isStart: r.isStart,
    isExit: r.isExit,
    cx: r.cx,
    cy: r.cy,
    x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2,
  }));

  return { seed, size: SIZE, tiles, rooms: genRooms, doors: genDoors, layers };
}
