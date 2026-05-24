import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sprite } from "./sprites";
import { QUIPS, QuipKey, SubtitleCategory, SubtitleSettings, EXIT_QUIPS, pickRandom, pickLockedDoorQuip } from "./quips";
import "./Hellzone.css";

const WEAPON_SLOT_DATA = [
  { id: 'claws'        as const, abbrev: 'CLW', key: '1' },
  { id: 'subwoofer'    as const, abbrev: 'SUB', key: '2' },
  { id: 'woofer'       as const, abbrev: 'WOO', key: '3' },
  { id: 'tennis'       as const, abbrev: 'TEN', key: '4' },
  { id: 'flamethrower' as const, abbrev: 'FLA', key: '5' },
];

export default function Hellzone() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const faceRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current!;
    const canvas = canvasRef.current!;
    const mapCanvas = minimapRef.current!;
    const faceCanvas = faceRef.current!;

    const ctx = canvas.getContext("2d")!;
    const mapCtx = mapCanvas.getContext("2d")!;
    const faceCtx = faceCanvas.getContext("2d")!;

    // ── Constants ──────────────────────────────────────────────────────────────
    const SCREEN_W = 320, SCREEN_H = 180;
    const FOV = Math.PI / 3;
    const HALF_FOV = FOV / 2;
    const NUM_RAYS = SCREEN_W;
    const MAX_DEPTH = 20;
    const CELL = 64;
    const PLAYER_SPEED = 3.75;
    const TURN_SPEED = 0.022;
    const SPRINT_MULT = 2.0;
    const MOVE_ACCEL = 20;
    const TURN_ACCEL = 12;
    const MOUSE_SENSITIVITY = 0.002;

    // ── Seeded RNG ─────────────────────────────────────────────────────────────
    function mulberry32(seed: number) {
      return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    // ── BSP Map Generator ──────────────────────────────────────────────────────
    const MAP_W = 40, MAP_H = 40;
    const TILE_EMPTY = 0, TILE_WALL = 1, TILE_LAVA = 2, TILE_EXIT = 3, TILE_WINDOW = 4;
    const TILE_DOOR = 5, TILE_DOOR_RED = 6, TILE_DOOR_ORANGE = 7, TILE_DOOR_YELLOW = 8;
    const TILE_DOOR_GREEN = 9, TILE_DOOR_BLUE = 10, TILE_DOOR_PURPLE = 11;

    type KeyColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
    const KEY_COLORS: KeyColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
    const KEY_HEX: Record<KeyColor, [number,number,number]> = {
      red:    [255, 68,  68 ], orange: [255, 140,  0 ], yellow: [240, 220,  0 ],
      green:  [ 40, 210,  90], blue:   [ 60, 130, 255], purple: [170,  60, 255],
    };
    function isDoorTile(t: number) { return t >= TILE_DOOR && t <= TILE_DOOR_PURPLE; }
    function doorTileKeyColor(t: number): KeyColor | null {
      return t === TILE_DOOR ? null : KEY_COLORS[t - TILE_DOOR_RED];
    }

    interface Room { x: number; y: number; w: number; h: number; cx: number; cy: number; }
    interface DoorGroup { id: number; openProgress: number; state: 'closed' | 'opening' | 'open' | 'closing'; keyColor: KeyColor | null; tiles: Door[]; }
    interface Door { tx: number; ty: number; axis: 0 | 1; tileType: number; group: DoorGroup; }
    interface Enemy {
      x: number; y: number; angle: number; health: number; maxHealth: number;
      state: string; type: number; shootTimer: number; alertRange: number;
      speed: number; deathTimer: number; muzzleFlash: number;
      burning: boolean; burnTimer: number; burnDamage: number;
    }
    interface Pickup { x: number; y: number; type: string; taken: boolean; }

    type WeaponId = 'claws' | 'subwoofer' | 'woofer' | 'tennis' | 'flamethrower';
    const WEAPON_DEFS = {
      claws:        { slot: 1, fullName: 'CLAWS',          minDmg: 22, maxDmg: 32, cooldown: 25, ammoType: null    as null },
      subwoofer:    { slot: 2, fullName: 'SUBWOOFER',      minDmg: 15, maxDmg: 24, cooldown: 12, ammoType: 'bullets' as const },
      woofer:       { slot: 3, fullName: 'WOOFER',         minDmg: 15, maxDmg: 24, cooldown: 5,  ammoType: 'bullets' as const },
      tennis:       { slot: 4, fullName: 'TENNIS LAUNCHER',minDmg: 14, maxDmg: 20, cooldown: 30, ammoType: 'balls'   as const },
      flamethrower: { slot: 5, fullName: 'DA FLAMTHROWER', minDmg: 4,  maxDmg: 7,  cooldown: 3,  ammoType: 'fuel'    as const },
    } as const;

    interface Projectile { x: number; y: number; velX: number; velY: number; damage: number; age: number; maxAge: number; }
    interface FlameParticle { x: number; y: number; velX: number; velY: number; age: number; maxAge: number; damage: number; }

    class BSPNode {
      x: number; y: number; w: number; h: number;
      left: BSPNode | null = null;
      right: BSPNode | null = null;
      room: Room | null = null;
      constructor(x: number, y: number, w: number, h: number) {
        this.x = x; this.y = y; this.w = w; this.h = h;
      }
    }

    function generateMap(seed: number) {
      const rng = mulberry32(seed);
      const grid: Uint8Array[] = Array.from({ length: MAP_H }, () => new Uint8Array(MAP_W).fill(TILE_WALL));
      const MIN_SIZE = 6, MAX_SIZE = 16;

      function split(node: BSPNode, depth: number) {
        if (depth === 0 || node.w < MIN_SIZE * 2 || node.h < MIN_SIZE * 2) return;
        const canH = node.h >= MIN_SIZE * 2;
        const canV = node.w >= MIN_SIZE * 2;
        const horizontal = canH && (!canV || rng() > 0.5);
        if (horizontal) {
          const splitY = Math.floor(MIN_SIZE + rng() * (node.h - MIN_SIZE * 2));
          node.left = new BSPNode(node.x, node.y, node.w, splitY);
          node.right = new BSPNode(node.x, node.y + splitY, node.w, node.h - splitY);
        } else {
          const splitX = Math.floor(MIN_SIZE + rng() * (node.w - MIN_SIZE * 2));
          node.left = new BSPNode(node.x, node.y, splitX, node.h);
          node.right = new BSPNode(node.x + splitX, node.y, node.w - splitX, node.h);
        }
        split(node.left, depth - 1);
        split(node.right, depth - 1);
      }

      function placeRooms(node: BSPNode): Room | null {
        if (!node.left && !node.right) {
          const rw = Math.floor(3 + rng() * (Math.min(node.w - 3, MAX_SIZE - 3)));
          const rh = Math.floor(3 + rng() * (Math.min(node.h - 3, MAX_SIZE - 3)));
          const rx = node.x + Math.floor(1 + rng() * (node.w - rw - 2));
          const ry = node.y + Math.floor(1 + rng() * (node.h - rh - 2));
          node.room = { x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) };
          for (let y = ry; y < ry + rh; y++)
            for (let x = rx; x < rx + rw; x++)
              grid[y][x] = TILE_EMPTY;
          return node.room;
        }
        const lRoom = placeRooms(node.left!);
        const rRoom = placeRooms(node.right!);
        if (lRoom && rRoom) connectRooms(lRoom, rRoom);
        return lRoom || rRoom;
      }

      function connectRooms(a: Room, b: Room) {
        const ax = a.cx, ay = a.cy, bx = b.cx, by = b.cy;
        if (rng() > 0.5) { carveLine(ax, ay, bx, ay); carveLine(bx, ay, bx, by); }
        else              { carveLine(ax, ay, ax, by); carveLine(ax, by, bx, by); }
      }

      function carveLine(x0: number, y0: number, x1: number, y1: number) {
        if (x0 === x1) {
          const [a, b] = y0 < y1 ? [y0, y1] : [y1, y0];
          for (let y = a; y <= b; y++) if (y >= 0 && y < MAP_H && x0 >= 0 && x0 < MAP_W) grid[y][x0] = TILE_EMPTY;
        } else {
          const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0];
          for (let x = a; x <= b; x++) if (y0 >= 0 && y0 < MAP_H && x >= 0 && x < MAP_W) grid[y0][x] = TILE_EMPTY;
        }
      }

      const bspRoot = new BSPNode(1, 1, MAP_W - 2, MAP_H - 2);
      split(bspRoot, 5);
      placeRooms(bspRoot);

      const rooms: Room[] = [];
      function collectRooms(node: BSPNode | null) {
        if (!node) return;
        if (node.room) rooms.push(node.room);
        collectRooms(node.left);
        collectRooms(node.right);
      }
      collectRooms(bspRoot);

      if (rooms.length > 1) {
        const exitRoom = rooms[rooms.length - 1];
        grid[exitRoom.cy][exitRoom.cx] = TILE_EXIT;
      }

      const enemies: Enemy[] = [];
      for (let i = 1; i < rooms.length; i++) {
        const room = rooms[i];
        const count = Math.floor(1 + rng() * 3);
        for (let e = 0; e < count; e++) {
          enemies.push({
            x: (room.x + 1 + rng() * (room.w - 2)) * CELL + CELL / 2,
            y: (room.y + 1 + rng() * (room.h - 2)) * CELL + CELL / 2,
            angle: rng() * Math.PI * 2,
            health: 40, maxHealth: 40,
            state: "idle", type: Math.floor(rng() * 3),
            shootTimer: 60 + Math.floor(rng() * 120),
            alertRange: 6 * CELL, speed: 0, deathTimer: 0, muzzleFlash: 0,
            burning: false, burnTimer: 0, burnDamage: 0,
          });
        }
      }

      const pickups: Pickup[] = [];
      for (let i = 2; i < rooms.length - 1; i += 2) {
        const room = rooms[i];
        pickups.push({ x: (room.cx + 0.5) * CELL, y: (room.cy + 0.5) * CELL, type: rng() > 0.5 ? "health" : "bullets", taken: false });
      }
      // Place one weapon pickup per level in mid-to-late rooms
      const weaponTypes: string[] = ['weapon-woofer', 'weapon-tennis', 'weapon-flamethrower'];
      const wIdx = Math.floor(rng() * weaponTypes.length);
      const wRoomIdx = Math.min(Math.floor(rooms.length * 0.5), rooms.length - 2);
      if (wRoomIdx >= 1) {
        pickups.push({ x: (rooms[wRoomIdx].cx + 0.5) * CELL, y: (rooms[wRoomIdx].cy + 0.5) * CELL, type: weaponTypes[wIdx], taken: false });
      }
      // Extra ammo pickups in later rooms
      if (rooms.length > 6) {
        const lateRoom = rooms[Math.floor(rooms.length * 0.75)];
        const ammoTypes: string[] = ['bullets', 'fuel', 'balls'];
        pickups.push({ x: (lateRoom.cx + 0.5) * CELL, y: (lateRoom.cy + 0.5) * CELL, type: ammoTypes[Math.floor(rng() * ammoTypes.length)], taken: false });
      }

      // Post-pass: ~25% of walls adjacent to open space become lava walls.
      for (let py = 1; py < MAP_H - 1; py++) {
        for (let px = 1; px < MAP_W - 1; px++) {
          if (grid[py][px] !== TILE_WALL) continue;
          const hasOpen = grid[py-1][px] === TILE_EMPTY || grid[py+1][px] === TILE_EMPTY
                       || grid[py][px-1] === TILE_EMPTY || grid[py][px+1] === TILE_EMPTY;
          if (hasOpen && rng() < 0.25) grid[py][px] = TILE_LAVA;
        }
      }

      // Post-pass: thin walls (open space on both opposing sides) become iron-bar windows.
      for (let py = 1; py < MAP_H - 1; py++) {
        for (let px = 1; px < MAP_W - 1; px++) {
          if (grid[py][px] !== TILE_WALL) continue;
          const nsOpen = grid[py-1][px] === TILE_EMPTY && grid[py+1][px] === TILE_EMPTY;
          const ewOpen = grid[py][px-1] === TILE_EMPTY && grid[py][px+1] === TILE_EMPTY;
          if ((nsOpen || ewOpen) && rng() < 0.45) grid[py][px] = TILE_WINDOW;
        }
      }

      const spawn = { x: (rooms[0].cx + 0.5) * CELL, y: (rooms[0].cy + 0.5) * CELL, angle: 0 };
      return { grid, rooms, enemies, pickups, spawn, seed };
    }

    // ── Training Level Map ─────────────────────────────────────────────────────
    function generateTrainingMap() {
      const grid: Uint8Array[] = Array.from({ length: MAP_H }, () => new Uint8Array(MAP_W).fill(TILE_WALL));

      // Room A: shooting range
      for (let y = 2; y <= 12; y++)
        for (let x = 3; x <= 22; x++)
          grid[y][x] = TILE_EMPTY;

      // Hallway A→B (3 tiles wide)
      for (let y = 13; y <= 19; y++)
        for (let x = 10; x <= 12; x++)
          grid[y][x] = TILE_EMPTY;
      // 3-wide door at hallway entrance — tests multi-tile door grouping
      grid[13][10] = TILE_DOOR;
      grid[13][11] = TILE_DOOR;
      grid[13][12] = TILE_DOOR;

      // Room B: patrol range (full area y=20–34)
      for (let y = 20; y <= 34; y++)
        for (let x = 3; x <= 24; x++)
          grid[y][x] = TILE_EMPTY;

      // Dividing wall inside Room B at y=26: tests 3-wide horizontal door grouping
      // (mirrors the A→B door — same mechanic, same width, second test of multi-tile BFS)
      for (let x = 3; x <= 24; x++) grid[26][x] = TILE_WALL;
      grid[26][11] = TILE_DOOR;
      grid[26][12] = TILE_DOOR;
      grid[26][13] = TILE_DOOR;

      // Exit
      for (let x = 11; x <= 13; x++)
        grid[35][x] = TILE_EXIT;

      const enemies: Enemy[] = [];

      const mkDummy = (x: number, y: number): Enemy => ({
        x, y, angle: 0, health: 50, maxHealth: 50,
        state: "idle", type: 3, shootTimer: 999999, alertRange: 0, speed: 0, deathTimer: 0, muzzleFlash: 0,
        burning: false, burnTimer: 0, burnDamage: 0,
      });

      let pi = 0;
      const mkPatrol = (x: number, y: number): Enemy => ({
        x, y, angle: (pi++ * 1.618) % (Math.PI * 2),
        health: 40, maxHealth: 40,
        state: "idle", type: pi % 3, shootTimer: 999999, alertRange: 0, speed: 0, deathTimer: 0, muzzleFlash: 0,
        burning: false, burnTimer: 0, burnDamage: 0,
      });

      const sY = 12.45 * CELL;
      [8.5, 10.5, 12.5, 14.5, 16.5].forEach(col => enemies.push(mkDummy(col * CELL, sY)));

      const wX = 3.65 * CELL, eX = 21.35 * CELL;
      [5.0, 8.5].forEach(row => {
        enemies.push(mkDummy(wX, row * CELL));
        enemies.push(mkDummy(eX, row * CELL));
      });

      [
        [6.5, 22.5], [12.5, 22.5], [18.5, 23.5], [22.5, 24.5],
        [5.5, 27.5], [11.5, 29.5], [17.5, 27.5], [21.5, 30.5],
        [8.5, 33.5], [15.5, 32.5],
      ].forEach(([col, row]) => enemies.push(mkPatrol(col * CELL, row * CELL)));

      // ── Room C (door/key test area) ──────────────────────────────────────────
      // Single door connecting south half of Room B → Room C
      grid[28][25] = TILE_DOOR;

      // Room C main area: cols 26-37, rows 22-34
      for (let y = 22; y <= 34; y++)
        for (let x = 26; x <= 37; x++)
          grid[y][x] = TILE_EMPTY;

      // North alcoves (above Room C y=22 wall, cut into rows 19-20 at cols 26-36)
      // RED alcove: cols 26-28, rows 19-20; door at (27,21)
      for (let y = 19; y <= 20; y++) for (let x = 26; x <= 28; x++) grid[y][x] = TILE_EMPTY;
      grid[21][27] = TILE_DOOR_RED;
      // ORANGE alcove: cols 30-32, rows 19-20; door at (31,21)
      for (let y = 19; y <= 20; y++) for (let x = 30; x <= 32; x++) grid[y][x] = TILE_EMPTY;
      grid[21][31] = TILE_DOOR_ORANGE;
      // YELLOW alcove: cols 34-36, rows 19-20; door at (35,21)
      for (let y = 19; y <= 20; y++) for (let x = 34; x <= 36; x++) grid[y][x] = TILE_EMPTY;
      grid[21][35] = TILE_DOOR_YELLOW;

      // South alcoves (below Room C y=34 wall, cut into rows 35-36 at cols 26-36)
      // GREEN alcove: cols 26-28, rows 35-36; door at (27,35)
      for (let y = 35; y <= 36; y++) for (let x = 26; x <= 28; x++) grid[y][x] = TILE_EMPTY;
      grid[35][27] = TILE_DOOR_GREEN;
      // BLUE alcove: cols 30-32, rows 35-36; door at (31,35)
      for (let y = 35; y <= 36; y++) for (let x = 30; x <= 32; x++) grid[y][x] = TILE_EMPTY;
      grid[35][31] = TILE_DOOR_BLUE;
      // PURPLE alcove: cols 34-36, rows 35-36; door at (35,35)
      for (let y = 35; y <= 36; y++) for (let x = 34; x <= 36; x++) grid[y][x] = TILE_EMPTY;
      grid[35][35] = TILE_DOOR_PURPLE;

      const pickups: Pickup[] = [
        { x: 6.5 * CELL,  y: 3.5 * CELL,  type: "ammo",   taken: false },
        { x: 19.5 * CELL, y: 3.5 * CELL,  type: "health", taken: false },
        { x: 13.5 * CELL, y: 27.5 * CELL, type: "ammo",   taken: false },
        { x: 13.5 * CELL, y: 31.5 * CELL, type: "health", taken: false },
        // Keys: scattered in Room A and Room B, accessible without any doors
        { x: 6.5  * CELL, y: 8.5  * CELL, type: 'key-red',    taken: false },
        { x: 18.5 * CELL, y: 8.5  * CELL, type: 'key-orange', taken: false },
        { x: 6.5  * CELL, y: 24.5 * CELL, type: 'key-yellow', taken: false },
        { x: 20.5 * CELL, y: 24.5 * CELL, type: 'key-green',  taken: false },
        { x: 6.5  * CELL, y: 31.5 * CELL, type: 'key-blue',   taken: false },
        { x: 20.5 * CELL, y: 31.5 * CELL, type: 'key-purple', taken: false },
        // Health packs in alcoves (reward for unlocking)
        { x: 27.5 * CELL, y: 19.5 * CELL, type: 'health', taken: false },
        { x: 31.5 * CELL, y: 19.5 * CELL, type: 'health', taken: false },
        { x: 35.5 * CELL, y: 19.5 * CELL, type: 'health', taken: false },
        { x: 27.5 * CELL, y: 35.5 * CELL, type: 'ammo',   taken: false },
        { x: 31.5 * CELL, y: 35.5 * CELL, type: 'ammo',   taken: false },
        { x: 35.5 * CELL, y: 35.5 * CELL, type: 'ammo',   taken: false },
      ];

      const rooms: Room[] = [
        { x: 3, y: 2,  w: 20, h: 11, cx: 12, cy: 7  },
        { x: 3, y: 20, w: 22, h: 15, cx: 13, cy: 27 },
        { x: 26, y: 22, w: 12, h: 13, cx: 32, cy: 28 },
      ];

      return { grid, rooms, enemies, pickups, spawn: { x: 12.5 * CELL, y: 4.5 * CELL, angle: Math.PI / 2 }, seed: 0 };
    }

    // ── Colors ─────────────────────────────────────────────────────────────────
    // Used as fallback when texture sprites haven't loaded yet.
    const WALL_COLORS = [
      null,
      { light: "#4a3020", dark: "#2e1d10" },  // 1: rock
      { light: "#cc4400", dark: "#882200" },  // 2: lava
      { light: "#FFD700", dark: "#AA8800" },  // 3: exit
      { light: "#333322", dark: "#1a1a11" },  // 4: window
      { light: "#9a7030", dark: "#7a5020" },  // 5: basic door
      { light: "#cc2222", dark: "#881111" },  // 6: red door
      { light: "#cc6600", dark: "#884400" },  // 7: orange door
      { light: "#cccc00", dark: "#888800" },  // 8: yellow door
      { light: "#00aa44", dark: "#006622" },  // 9: green door
      { light: "#2244cc", dark: "#112288" },  // 10: blue door
      { light: "#8822cc", dark: "#551188" },  // 11: purple door
    ];
    const FLOOR_COLOR = "#1a1008";
    const CEILING_COLOR = "#0a0a14";
    const ENEMY_COLORS = ["#cc3300", "#993300", "#cc6600"];

    // ── Game State ─────────────────────────────────────────────────────────────
    type Player = {
      x: number; y: number; angle: number; health: number; ammo: number;
      velX: number; velY: number; angVel: number;
    };

    let map: Uint8Array[];
    let player: Player;
    let enemies: Enemy[];
    let pickups: Pickup[];
    const keys: Record<string, boolean> = {};
    let kills = 0, totalKills = 0;
    let level = 1, seed = 0;
    let gameState = "title";
    let messageTimer = 0;
    let showFullMap = false;
    let flashTimer = 0;
    let shootCooldown = 0;
    let pointerLocked = false;
    const zBuffer = new Float32Array(NUM_RAYS);
    let gunRecoil = 0;
    let muzzleFlashTimer = 0;
    let sprinting = false;
    let capsLocked = false;
    let hurtCooldown = 0;
    let showHelp = false;
    interface Impact { sx: number; sy: number; type: string; timer: number; maxTimer: number; }
    const impacts: Impact[] = [];

    // ── Quip / subtitle system ──────────────────────────────────────────────────
    // Combat quips queue until a lull (no kills/damage for ~1.5 s), then one fires.
    // monster_tell is always shown; player and monster_voice are user-toggleable.
    let subtitleSettings: SubtitleSettings = { player: true, monster_voice: true };
    let quipQueue: Array<{ key: QuipKey; weaponKey?: QuipKey }> = [];
    let quipCooldown = 0;    // frames until next quip can fire
    let quipLullTimer = 0;   // frames since last combat signal; 0 = lull
    let playerLowHealthQuipped = false;
    let prevBullets = 50;
    let prevBalls = 0;
    let prevFuel = 0;

    // ── Weapon state ───────────────────────────────────────────────────────────
    let ownedWeapons = new Set<WeaponId>(['claws', 'subwoofer']);
    let currentWeapon: WeaponId = 'subwoofer';
    let switchState: 'idle' | 'lowering' | 'raising' = 'idle';
    let switchProgress = 0;
    let switchingTo: WeaponId = 'subwoofer';
    let ballAmmo = 0;
    let fuelAmmo = 0;
    let mouseHeld = false;
    let touchFireHeld = false;
    const projectiles: Projectile[] = [];
    const flameParticles: FlameParticle[] = [];

    // ── Door / key state ───────────────────────────────────────────────────────
    const DOOR_TEX_SIZE = 64;
    const doorTextures = new Map<number, HTMLCanvasElement>();
    let doors: Door[] = [];
    let doorGroups: DoorGroup[] = [];
    const doorMap = new Map<string, Door>();
    let heldKeys = new Set<KeyColor>();
    let lockedMsgTimer = 0;

    // ── Cheat state ────────────────────────────────────────────────────────────
    let godMode = false;
    let infAmmo = false;
    let cheatBuffer = '';
    let cheatClearTimer = 0;
    let showCheatsMenu = false;
    let showExitConfirm = false;
    let longPressTriggered = false;

    // ── Sprites ─────────────────────────────────────────────────────────────────
    const sprWallRock = new Sprite('/sprites/wall-rock.png');
    // Lava sheet: 2×2 grid of 4 frames, each 627×627 within a 1254×1254 image.
    const sprWallLava = new Sprite('/sprites/wall-lava.png', [
      { x: 0,   y: 0,   w: 627, h: 627 },
      { x: 627, y: 0,   w: 627, h: 627 },
      { x: 0,   y: 627, w: 627, h: 627 },
      { x: 627, y: 627, w: 627, h: 627 },
    ]);

    const sprEnemy = [
      new Sprite('/sprites/enemy-0.png'),
      new Sprite('/sprites/enemy-1.png'),
      new Sprite('/sprites/enemy-2.png'),
    ];
    const sprEnemyDead = new Sprite('/sprites/enemy-dead.png');
    const sprTarget = new Sprite('/sprites/target-dummy.png');
    const sprTargetDead = new Sprite('/sprites/target-dummy-dead.png');
    const sprPickupHealth = new Sprite('/sprites/pickup-health.png');
    const sprPickupAmmo = new Sprite('/sprites/pickup-ammo.png');
    const sprWeapon: Record<WeaponId, Sprite> = {
      claws:        new Sprite('/sprites/gun-claws.png'),
      subwoofer:    new Sprite('/sprites/gun-subwoofer.png'),
      woofer:       new Sprite('/sprites/gun-woofer.png'),
      tennis:       new Sprite('/sprites/gun-tennis.png'),
      flamethrower: new Sprite('/sprites/gun-flamethrower.png'),
    };
    const sprPickupBullets  = new Sprite('/sprites/pickup-bullets.png');
    const sprPickupFuel     = new Sprite('/sprites/pickup-fuel.png');
    const sprPickupBalls    = new Sprite('/sprites/pickup-balls.png');
    const sprPickupWoofer   = new Sprite('/sprites/pickup-weapon-woofer.png');
    const sprPickupTennis   = new Sprite('/sprites/pickup-weapon-tennis.png');
    const sprPickupFlame    = new Sprite('/sprites/pickup-weapon-flamethrower.png');
    const sprTennisBall     = new Sprite('/sprites/projectile-tennis.png');
    const sprFlameParticle  = new Sprite('/sprites/flame-particle.png');
    const sprImpactWall = new Sprite('/sprites/impact-wall.png');
    const sprImpactEnemy = new Sprite('/sprites/impact-enemy.png');
    const sprKeys: Record<KeyColor, Sprite> = {
      red:    new Sprite('/sprites/key-red.png'),
      orange: new Sprite('/sprites/key-orange.png'),
      yellow: new Sprite('/sprites/key-yellow.png'),
      green:  new Sprite('/sprites/key-green.png'),
      blue:   new Sprite('/sprites/key-blue.png'),
      purple: new Sprite('/sprites/key-purple.png'),
    };

    // ── Sound system ───────────────────────────────────────────────────────────
    let audioCtx: AudioContext | null = null;
    const soundBuffers = new Map<string, AudioBuffer>();

    function initAudio() {
      if (audioCtx) return;
      try {
        audioCtx = new AudioContext();
        const names = [
          'intro','shoot','hit-wall','hit-enemy','hurt','death','level-complete','pickup','alert',
          'shoot-subwoofer','shoot-woofer','swipe-claws','hit-claws',
          'shoot-tennis','bounce-tennis','shoot-flamethrower','burning',
          'pickup-weapon','weapon-switch','door-open',
        ];
        for (const name of names) {
          fetch(`/sounds/${name}.wav`)
            .then(r => r.arrayBuffer())
            .then(buf => audioCtx!.decodeAudioData(buf))
            .then(decoded => { soundBuffers.set(name, decoded); })
            .catch(() => {});
        }
      } catch { /* no audio available */ }
    }

    function playSound(name: string, volume = 1.0) {
      if (!audioCtx || !soundBuffers.has(name)) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const src = audioCtx.createBufferSource();
      src.buffer = soundBuffers.get(name)!;
      const gain = audioCtx.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      src.start();
    }

    // ── DOM element getters ────────────────────────────────────────────────────
    const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;

    // ── Game screen switcher ───────────────────────────────────────────────────
    function setScreen(s: string) {
      gameState = s;
      q<HTMLElement>(".hz-title-screen").style.display   = s === "title" ? "flex" : "none";
      q<HTMLElement>(".hz-game-container").style.display = s !== "title" ? "flex" : "none";
      q<HTMLElement>(".hz-death-screen").style.display   = s === "dead" ? "flex" : "none";
      q<HTMLElement>(".hz-level-clear").style.display    = s === "clear" ? "flex" : "none";
      if (s === "clear") { playSound('level-complete'); fireQuip('level_clear'); }
      if (s === "title") playSound('intro');
    }

    function quitToTos() {
      if (document.pointerLockElement) document.exitPointerLock();
      navigateRef.current("/ns-tos");
    }

    function showExitModal() {
      if (document.pointerLockElement) document.exitPointerLock();
      const quip = pickRandom(EXIT_QUIPS);
      const modal = root.querySelector<HTMLElement>('.hz-exit-modal');
      if (!modal) return;
      const promptEl = modal.querySelector<HTMLElement>('.hz-exit-prompt');
      const stayEl   = modal.querySelector<HTMLElement>('.hz-exit-stay');
      const quitEl   = modal.querySelector<HTMLElement>('.hz-exit-quit');
      if (promptEl) promptEl.textContent = quip.prompt;
      if (stayEl)   stayEl.textContent   = `[ Y ]  ${quip.stay}`;
      if (quitEl)   quitEl.textContent   = `[ N ]  ${quip.quit}`;
      modal.style.display = 'flex';
      showExitConfirm = true;
    }

    function hideExitModal() {
      const modal = root.querySelector<HTMLElement>('.hz-exit-modal');
      if (modal) modal.style.display = 'none';
      showExitConfirm = false;
    }

    // ── Level init ─────────────────────────────────────────────────────────────
    function startGame() {
      kills = 0; totalKills = 0; level = 1;
      seed = Math.floor(Math.random() * 99999);
      player = null as unknown as Player;
      ownedWeapons = new Set<WeaponId>(['claws', 'subwoofer']);
      currentWeapon = 'subwoofer';
      switchState = 'idle'; switchProgress = 0; switchingTo = 'subwoofer';
      ballAmmo = 0; fuelAmmo = 0;
      projectiles.length = 0; flameParticles.length = 0;
      godMode = false; infAmmo = false; cheatBuffer = ''; clearTimeout(cheatClearTimer);
      initLevel();
      setScreen("playing");
    }

    function nextLevel() {
      level++;
      seed = Math.floor(Math.random() * 99999);
      projectiles.length = 0; flameParticles.length = 0;
      initLevel();
      setScreen("playing");
      setTimeout(() => { if (gameState === 'playing') { fireQuip('level_start'); quipCooldown = 300; } }, 1500);
    }

    function switchWeapon(to: WeaponId) {
      if (currentWeapon === to || switchState !== 'idle') return;
      if (!ownedWeapons.has(to)) return;
      switchState = 'lowering'; switchingTo = to;
      playSound('weapon-switch', 0.5);
    }

    function activateCheat(code: 'god' | 'boom' | 'key') {
      if (code === 'god') {
        godMode = !godMode;
        showMessage(godMode ? 'EGOD: GOD MODE ON' : 'EGOD: GOD MODE OFF');
      } else if (code === 'boom') {
        infAmmo = !infAmmo;
        if (infAmmo) {
          ownedWeapons = new Set<WeaponId>(['claws','subwoofer','woofer','tennis','flamethrower']);
          if (player) { player.ammo = 99; ballAmmo = 50; fuelAmmo = 99; }
          showMessage('EGOBOOM: ALL WEAPONS LOADED');
        } else {
          showMessage('EGOBOOM: AMMO NORMAL');
        }
      } else {
        KEY_COLORS.forEach(c => heldKeys.add(c));
        showMessage('EGOKEY: ALL KEYS');
      }
      updateCheatsMenu();
    }

    function updateCheatsMenu() {
      const overlay = root.querySelector<HTMLElement>('.hz-cheats-overlay');
      if (overlay) overlay.style.display = showCheatsMenu ? 'flex' : 'none';
      const godBtn  = root.querySelector<HTMLElement>('#hz-cheat-god');
      const boomBtn = root.querySelector<HTMLElement>('#hz-cheat-boom');
      const keyBtn  = root.querySelector<HTMLElement>('#hz-cheat-key');
      if (godBtn)  godBtn.className  = 'hz-cheat-btn' + (godMode ? ' active' : '');
      if (boomBtn) boomBtn.className = 'hz-cheat-btn' + (infAmmo ? ' active' : '');
      if (keyBtn)  keyBtn.className  = 'hz-cheat-btn' + (heldKeys.size === KEY_COLORS.length ? ' active' : '');
    }

    function buildDoorMap() {
      doors = [];
      doorGroups = [];
      doorMap.clear();
      const visited = new Set<string>();
      let groupId = 0;

      for (let ty = 0; ty < MAP_H; ty++) {
        for (let tx = 0; tx < MAP_W; tx++) {
          const startKey = `${tx},${ty}`;
          if (visited.has(startKey)) continue;
          const t = map[ty][tx];
          if (!isDoorTile(t)) continue;

          const group: DoorGroup = { id: groupId++, openProgress: 0, state: 'closed', keyColor: doorTileKeyColor(t), tiles: [] };
          doorGroups.push(group);
          const queue: Array<{ tx: number; ty: number }> = [{ tx, ty }];
          visited.add(startKey);

          while (queue.length > 0) {
            const { tx: cx, ty: cy } = queue.shift()!;
            const ct = map[cy][cx];
            if (!isDoorTile(ct)) continue;
            // axis=0: corridor runs E-W (walls to N/S); axis=1: corridor runs N-S (walls to E/W)
            const northSolid = cy > 0 && (map[cy-1][cx] === TILE_WALL || isDoorTile(map[cy-1][cx]));
            const southSolid = cy < MAP_H-1 && (map[cy+1][cx] === TILE_WALL || isDoorTile(map[cy+1][cx]));
            const axis: 0 | 1 = (northSolid || southSolid) ? 0 : 1;
            const door: Door = { tx: cx, ty: cy, axis, tileType: ct, group };
            doors.push(door);
            doorMap.set(`${cx},${cy}`, door);
            group.tiles.push(door);
            // BFS: spread to adjacent door tiles to form a group
            for (const [nx, ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]] as [number,number][]) {
              const nk = `${nx},${ny}`;
              if (visited.has(nk)) continue;
              if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
              if (!isDoorTile(map[ny][nx])) continue;
              visited.add(nk);
              queue.push({ tx: nx, ty: ny });
            }
          }
        }
      }
    }

    function buildDoorTextures() {
      const sz = DOOR_TEX_SIZE;
      for (let tileType = TILE_DOOR; tileType <= TILE_DOOR_PURPLE; tileType++) {
        const offscreen = document.createElement('canvas');
        offscreen.width = sz; offscreen.height = sz;
        const oc = offscreen.getContext('2d')!;
        if (tileType === TILE_DOOR) {
          // Warm wood panel
          oc.fillStyle = '#a07030'; oc.fillRect(0, 0, sz, sz);
          // Frame
          oc.fillStyle = '#4e2e08';
          oc.fillRect(0, 0, sz, 4); oc.fillRect(0, sz-4, sz, 4);
          oc.fillRect(0, 0, 3, sz); oc.fillRect(sz-3, 0, 3, sz);
          // Panel shading
          oc.fillStyle = '#8a6028';
          oc.fillRect(3, 4, sz-6, 24); oc.fillRect(3, 36, sz-6, 24);
          // Center bar
          oc.fillStyle = '#7a5020'; oc.fillRect(3, 28, sz-6, 8);
        } else {
          const kc = doorTileKeyColor(tileType)!;
          const [r, g, b] = KEY_HEX[kc];
          // Dark gray body
          oc.fillStyle = '#303030'; oc.fillRect(0, 0, sz, sz);
          // Colored center band
          oc.fillStyle = `rgb(${r},${g},${b})`; oc.fillRect(0, 18, sz, 28);
          // Frame
          oc.fillStyle = '#181818';
          oc.fillRect(0, 0, sz, 4); oc.fillRect(0, sz-4, sz, 4);
          oc.fillRect(0, 0, 3, sz); oc.fillRect(sz-3, 0, 3, sz);
          // Keyhole
          oc.fillStyle = '#050505';
          oc.fillRect(29, 28, 6, 10); oc.fillRect(27, 34, 10, 4);
        }
        doorTextures.set(tileType, offscreen);
      }
    }

    function updateDoors(dt: number) {
      if (lockedMsgTimer > 0) lockedMsgTimer -= dt * 60;
      for (const group of doorGroups) {
        if (group.state === 'opening') {
          group.openProgress = Math.min(1, group.openProgress + dt * 2.2);
          if (group.openProgress >= 1) {
            group.state = 'open';
            for (const d of group.tiles) map[d.ty][d.tx] = TILE_EMPTY;
          }
        } else if (group.state === 'closing') {
          group.openProgress = Math.max(0, group.openProgress - dt * 2.2);
          if (group.openProgress <= 0) {
            group.state = 'closed';
            for (const d of group.tiles) map[d.ty][d.tx] = d.tileType;
          }
        }
      }
    }

    function tryUseDoor() {
      const px = player.x / CELL, py = player.y / CELL;
      let nearest: Door | null = null, nearDist = 1.6;
      for (const door of doors) {
        const dx = door.tx + 0.5 - px, dy = door.ty + 0.5 - py;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearDist) { nearDist = d; nearest = door; }
      }
      if (!nearest) return;
      const group = nearest.group;
      if (group.state === 'open') {
        group.state = 'closing';
        for (const d of group.tiles) map[d.ty][d.tx] = d.tileType;
        softFireQuip('action_close_door');
        playSound('door-open', 0.45);
      } else if (group.state === 'closed') {
        if (group.keyColor !== null && !heldKeys.has(group.keyColor)) {
          if (lockedMsgTimer <= 0) {
            const lq = pickLockedDoorQuip(group.keyColor);
            showMessage(lq.text, 'player', lq.audio);
            lockedMsgTimer = 60;
          }
          return;
        }
        group.state = 'opening';
        softFireQuip('action_open_door');
        playSound('door-open', 0.55);
      }
    }

    function initLevel() {
      const data = level === 1 ? generateTrainingMap() : generateMap(seed);
      map = data.grid;
      enemies = data.enemies;
      pickups = data.pickups;
      totalKills = enemies.length;
      heldKeys = new Set<KeyColor>();
      lockedMsgTimer = 0;
      buildDoorMap();
      buildDoorTextures();
      player = {
        x: data.spawn.x, y: data.spawn.y, angle: data.spawn.angle,
        health: player ? Math.min(Math.max(player.health, 1), 100) : 100,
        ammo:   player ? Math.max(player.ammo, 10) : 50,
        velX: 0, velY: 0, angVel: 0,
      };
      // Reset quip system for the new level
      quipQueue.length = 0;
      quipCooldown = 180;
      quipLullTimer = 0;
      playerLowHealthQuipped = false;
      prevBullets = player.ammo;
      prevBalls = ballAmmo;
      prevFuel = fuelAmmo;
      if (level === 1) {
        setTimeout(() => showMessage("ROOM A: SHOOT THE TARGETS"), 600);
        setTimeout(() => showMessage("ROOM B: SOUTH HALLWAY — MOVING TARGETS"), 4000);
        setTimeout(() => showMessage("ROOM C: FIND KEYS — GO EAST THROUGH ROOM B"), 12000);
      }
    }

    function handleEnter() {
      if (gameState === "title") startGame();
      else if (gameState === "dead") startGame();
      else if (gameState === "clear") nextLevel();
    }

    // ── Raycasting ─────────────────────────────────────────────────────────────
    // skipGroupId: if set, rays pass through tiles belonging to that door group
    function castRay(angle: number, skipGroupId?: number) {
      const sinA = Math.sin(angle), cosA = Math.cos(angle);
      let mapX = Math.floor(player.x / CELL);
      let mapY = Math.floor(player.y / CELL);
      const rayDirX = cosA, rayDirY = sinA;
      const deltaDistX = Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(1 / rayDirY);
      let stepX: number, stepY: number, sideDistX: number, sideDistY: number;
      if (rayDirX < 0) { stepX = -1; sideDistX = (player.x / CELL - mapX) * deltaDistX; }
      else              { stepX =  1; sideDistX = (mapX + 1 - player.x / CELL) * deltaDistX; }
      if (rayDirY < 0) { stepY = -1; sideDistY = (player.y / CELL - mapY) * deltaDistY; }
      else              { stepY =  1; sideDistY = (mapY + 1 - player.y / CELL) * deltaDistY; }
      let hit = false, side = 0, dist = 0, tile = 0;
      let hitMapX = mapX, hitMapY = mapY;
      let glassHit: { dist: number; side: number; wallX: number } | null = null;
      for (let i = 0; i < MAX_DEPTH * 2; i++) {
        if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
        else                        { sideDistY += deltaDistY; mapY += stepY; side = 1; }
        if (mapX < 0 || mapX >= MAP_W || mapY < 0 || mapY >= MAP_H) { dist = MAX_DEPTH; break; }
        tile = map[mapY][mapX];
        if (tile === TILE_WINDOW) {
          if (!glassHit) {
            const gd = side === 0
              ? (mapX - player.x / CELL + (1 - stepX) / 2) / rayDirX
              : (mapY - player.y / CELL + (1 - stepY) / 2) / rayDirY;
            let gwx = side === 0 ? player.y / CELL + gd * rayDirY : player.x / CELL + gd * rayDirX;
            gwx -= Math.floor(gwx);
            glassHit = { dist: Math.max(gd, 0.1), side, wallX: gwx };
            continue;
          }
          hit = true; break;
        }
        if (isDoorTile(tile)) {
          if (skipGroupId !== undefined) {
            const skd = doorMap.get(`${mapX},${mapY}`);
            if (skd && skd.group.id === skipGroupId) continue;
          }
          hit = true; hitMapX = mapX; hitMapY = mapY; break;
        }
        if (tile === TILE_WALL || tile === TILE_LAVA || tile === TILE_EXIT) {
          hit = true; hitMapX = mapX; hitMapY = mapY; break;
        }
      }
      let wallX = 0;
      if (hit) {
        dist = side === 0
          ? (mapX - player.x / CELL + (1 - stepX) / 2) / rayDirX
          : (mapY - player.y / CELL + (1 - stepY) / 2) / rayDirY;
        let wx = side === 0 ? player.y / CELL + dist * rayDirY : player.x / CELL + dist * rayDirX;
        wallX = wx - Math.floor(wx);
      } else {
        dist = MAX_DEPTH;
      }
      return { dist: Math.max(dist, 0.1), side, tile, hit, wallX, glassHit, hitMapX, hitMapY };
    }

    // ── Rendering ──────────────────────────────────────────────────────────────
    function render() {
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = CEILING_COLOR;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H / 2);
      ctx.fillStyle = FLOOR_COLOR;
      ctx.fillRect(0, SCREEN_H / 2, SCREEN_W, SCREEN_H / 2);

      const lavaFrame = Math.floor(performance.now() / 250) % sprWallLava.frameCount;
      const glassColumns: Array<{ x: number; wallH: number; top: number; wallX: number; perpDist: number; side: number }> = [];

      for (let x = 0; x < NUM_RAYS; x++) {
        const rayAngle = player.angle - HALF_FOV + (x / NUM_RAYS) * FOV;
        const { dist, side, tile, hit, wallX, glassHit, hitMapX, hitMapY } = castRay(rayAngle);
        const perpDist = dist * Math.cos(rayAngle - player.angle);
        zBuffer[x] = hit ? perpDist : MAX_DEPTH;

        if (glassHit) {
          const gPerp = glassHit.dist * Math.cos(rayAngle - player.angle);
          const gWallH = (SCREEN_H / gPerp) * 0.8;
          glassColumns.push({ x, wallH: gWallH, top: (SCREEN_H - gWallH) / 2, wallX: glassHit.wallX, perpDist: gPerp, side: glassHit.side });
        }

        if (!hit) continue;
        const wallH = (SCREEN_H / perpDist) * 0.8;
        const top = (SCREEN_H - wallH) / 2;
        const fog = Math.max(0, 1 - perpDist / MAX_DEPTH);
        const baseFog = fog * fog + 0.05;

        if (tile === TILE_LAVA && sprWallLava.loaded) {
          ctx.globalAlpha = baseFog;
          sprWallLava.drawColumn(ctx, lavaFrame, wallX, x, top, wallH);
        } else if (tile === TILE_WALL && sprWallRock.loaded) {
          ctx.globalAlpha = side === 1 ? baseFog * 0.65 : baseFog;
          sprWallRock.drawColumn(ctx, 0, wallX, x, top, wallH);
        } else if (isDoorTile(tile)) {
          const door = doorMap.get(`${hitMapX},${hitMapY}`);
          const openProg = door ? door.group.openProgress : 0;

          // While animating, cast a behind ray and draw the corridor first.
          // The door panel is drawn on top and covers the still-closed portion.
          if (openProg > 0 && door) {
            const behind = castRay(rayAngle, door.group.id);
            const bPerp = behind.dist * Math.cos(rayAngle - player.angle);
            // Update zBuffer to behind depth so sprites in the open corridor
            // aren't culled by the door's (closer) depth — fixes pop-in on open.
            zBuffer[x] = bPerp;
            if (behind.hit) {
              const bWallH = (SCREEN_H / bPerp) * 0.8;
              const bTop = (SCREEN_H - bWallH) / 2;
              const bFog = Math.max(0, 1 - bPerp / MAX_DEPTH);
              const bBaseFog = bFog * bFog + 0.05;
              if (behind.tile === TILE_LAVA && sprWallLava.loaded) {
                ctx.globalAlpha = bBaseFog;
                sprWallLava.drawColumn(ctx, lavaFrame, behind.wallX, x, bTop, bWallH);
              } else if (behind.tile === TILE_WALL && sprWallRock.loaded) {
                ctx.globalAlpha = behind.side === 1 ? bBaseFog * 0.65 : bBaseFog;
                sprWallRock.drawColumn(ctx, 0, behind.wallX, x, bTop, bWallH);
              } else {
                const bColors = WALL_COLORS[behind.tile] || WALL_COLORS[1];
                ctx.globalAlpha = bBaseFog;
                ctx.fillStyle = behind.side === 1 ? bColors!.dark : bColors!.light;
                ctx.fillRect(x, bTop, 1, bWallH);
              }
              ctx.globalAlpha = 1;
            }
          }

          // Draw door panel (covers lower portion, leaving the open gap visible above)
          const drawnH = wallH * (1 - openProg);
          const doorTop = top + wallH * openProg;
          if (drawnH > 0.5) {
            ctx.globalAlpha = side === 1 ? baseFog * 0.65 : baseFog;
            const tex = doorTextures.get(tile);
            if (tex) {
              const srcX = Math.floor(wallX * DOOR_TEX_SIZE);
              const srcH = Math.max(0.5, DOOR_TEX_SIZE * (1 - openProg));
              ctx.drawImage(tex, srcX, 0, 1, srcH, x, doorTop, 1, drawnH);
            } else {
              const colors = WALL_COLORS[tile] || WALL_COLORS[1];
              ctx.fillStyle = side === 1 ? colors!.dark : colors!.light;
              ctx.fillRect(x, doorTop, 1, drawnH);
            }
          }
        } else {
          const colors = WALL_COLORS[tile] || WALL_COLORS[1];
          ctx.globalAlpha = baseFog;
          ctx.fillStyle = side === 1 ? colors!.dark : colors!.light;
          ctx.fillRect(x, top, 1, wallH);
        }
        ctx.globalAlpha = 1;
      }

      renderSprites();
      drawImpacts();

      // ── Iron-bar window overlay — drawn on top of sprites ──────────────────
      for (const g of glassColumns) {
        const fog = Math.max(0, 1 - g.perpDist / MAX_DEPTH);
        const barPhase = (g.wallX * 6) % 1;
        if (barPhase < 0.32) {
          ctx.globalAlpha = fog * 0.92 + 0.08;
          ctx.fillStyle = g.side === 1 ? "#1a0d06" : "#2a1a0a";
          ctx.fillRect(g.x, g.top, 1, g.wallH);
          ctx.globalAlpha = 1;
        }
      }

      drawWeapon();

      if (flashTimer > 0) {
        ctx.fillStyle = `rgba(200,0,0,${(flashTimer / 20) * 0.5})`;
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
        flashTimer--;
      }

      // Sprint indicator
      ctx.fillStyle = "#c00";
      ctx.font = "6px 'Share Tech Mono', monospace";
      ctx.fillText(sprinting ? "FST" : "SLO", 4, SCREEN_H - 4);

      // Cheat indicators
      if (godMode || infAmmo) {
        ctx.font = "6px 'Share Tech Mono', monospace";
        let cx2 = SCREEN_W - 2;
        if (infAmmo) {
          ctx.fillStyle = '#ffaa00';
          ctx.textAlign = 'right';
          ctx.fillText('∞AMMO', cx2, SCREEN_H - 4);
          cx2 -= 36;
        }
        if (godMode) {
          ctx.fillStyle = '#ffff00';
          ctx.textAlign = 'right';
          ctx.fillText('GOD', cx2, SCREEN_H - 4);
        }
        ctx.textAlign = 'left';
      }

      // Key icons (top-right of canvas)
      if (heldKeys.size > 0) {
        let kx = SCREEN_W - 2;
        for (let ki = KEY_COLORS.length - 1; ki >= 0; ki--) {
          const kc = KEY_COLORS[ki];
          if (!heldKeys.has(kc)) continue;
          const [r, g, b] = KEY_HEX[kc];
          const hexStr = `rgb(${r},${g},${b})`;
          const darkStr = `rgb(${Math.floor(r*0.5)},${Math.floor(g*0.5)},${Math.floor(b*0.5)})`;
          // Bow (ring)
          ctx.fillStyle = hexStr;
          ctx.fillRect(kx-6, 2, 5, 1); ctx.fillRect(kx-7, 3, 7, 1); ctx.fillRect(kx-7, 4, 7, 2);
          ctx.fillRect(kx-6, 6, 5, 1);
          // Hole in bow
          ctx.fillStyle = '#000'; ctx.fillRect(kx-5, 3, 3, 3);
          // Shaft
          ctx.fillStyle = hexStr;
          ctx.fillRect(kx-4, 7, 2, 5);
          // Teeth
          ctx.fillRect(kx-2, 9, 2, 1); ctx.fillRect(kx-2, 11, 2, 1);
          // Shadow on shaft bottom
          ctx.fillStyle = darkStr;
          ctx.fillRect(kx-3, 11, 1, 1);
          kx -= 10;
        }
      }

      // Door proximity prompt
      if (gameState === 'playing') {
        const ppx = player.x / CELL, ppy = player.y / CELL;
        let nearGroup: DoorGroup | null = null, nearDoorDist = 1.6;
        for (const door of doors) {
          if (door.group.state === 'opening') continue;
          const ddx = door.tx + 0.5 - ppx, ddy = door.ty + 0.5 - ppy;
          const dd = Math.sqrt(ddx*ddx + ddy*ddy);
          if (dd < nearDoorDist) { nearDoorDist = dd; nearGroup = door.group; }
        }
        if (nearGroup) {
          const label = nearGroup.state === 'open' ? '[E] CLOSE' : '[E] OPEN';
          ctx.font = "7px 'Share Tech Mono', monospace";
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(SCREEN_W/2 - 28, SCREEN_H/2 + 16, 56, 11);
          ctx.fillStyle = '#ffdd88';
          ctx.fillText(label, SCREEN_W/2, SCREEN_H/2 + 24);
          ctx.textAlign = 'left';
        }
      }

      updateHUD();

      if (showFullMap) renderFullMap();
    }

    function projectSprite(wx: number, wy: number) {
      const dx = (wx - player.x) / CELL, dy = (wy - player.y) / CELL;
      const cosA = Math.cos(player.angle), sinA = Math.sin(player.angle);
      const camZ =  dx * cosA + dy * sinA;
      const camX = -dx * sinA + dy * cosA;
      if (camZ <= 0.5) return null;
      const screenX = Math.floor(SCREEN_W / 2 + (camX / camZ) * (SCREEN_W / 2) / Math.tan(HALF_FOV));
      const spriteH = Math.max(4, Math.floor((SCREEN_H / camZ) * 0.9));
      return { screenX, spriteH, spriteW: spriteH, tz: camZ };
    }

    function renderSprites() {
      ctx.imageSmoothingEnabled = false;
      type SEntry = { type: string; obj: Enemy | Pickup | Projectile | FlameParticle; dist: number };
      const sprites: SEntry[] = [];
      for (const e of enemies) {
        const dx = e.x - player.x, dy = e.y - player.y;
        sprites.push({ type: "enemy", obj: e, dist: Math.sqrt(dx * dx + dy * dy) });
      }
      for (const p of pickups) {
        if (p.taken) continue;
        const dx = p.x - player.x, dy = p.y - player.y;
        sprites.push({ type: "pickup", obj: p, dist: Math.sqrt(dx * dx + dy * dy) });
      }
      for (const pr of projectiles) {
        const dx = pr.x - player.x, dy = pr.y - player.y;
        sprites.push({ type: "projectile", obj: pr, dist: Math.sqrt(dx * dx + dy * dy) });
      }
      for (const fp of flameParticles) {
        const dx = fp.x - player.x, dy = fp.y - player.y;
        sprites.push({ type: "flame", obj: fp, dist: Math.sqrt(dx * dx + dy * dy) });
      }
      sprites.sort((a, b) => b.dist - a.dist);
      for (const s of sprites) {
        if (s.type === "enemy")      drawEnemySprite(s.obj as Enemy);
        else if (s.type === "pickup")     drawPickupSprite(s.obj as Pickup);
        else if (s.type === "projectile") drawProjectileSprite(s.obj as Projectile);
        else if (s.type === "flame")      drawFlameSprite(s.obj as FlameParticle);
      }
    }

    function drawProjectileSprite(proj: Projectile) {
      const p = projectSprite(proj.x, proj.y);
      if (!p) return;
      const { screenX, tz } = p;
      const size = Math.max(2, Math.floor(8 / tz));
      const startX = Math.floor(screenX - size / 2);
      const startY = Math.floor(SCREEN_H / 2 - size / 2);
      const fog = Math.max(0, 1 - tz / MAX_DEPTH);
      ctx.globalAlpha = fog * 0.9 + 0.1;
      if (sprTennisBall.loaded) {
        for (let sx = 0; sx < size; sx++) {
          const px = startX + sx;
          if (px < 0 || px >= SCREEN_W) continue;
          if (tz >= zBuffer[px]) continue;
          sprTennisBall.drawColumn(ctx, 0, sx / size, px, startY, size);
        }
      } else {
        for (let sx = 0; sx < size; sx++) {
          const px = startX + sx;
          if (px < 0 || px >= SCREEN_W || tz >= zBuffer[px]) continue;
          ctx.fillStyle = '#aacc00';
          ctx.fillRect(px, startY, 1, size);
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawFlameSprite(fp: FlameParticle) {
      const p = projectSprite(fp.x, fp.y);
      if (!p) return;
      const { screenX, tz } = p;
      const lifeRatio = 1 - fp.age / fp.maxAge;
      const size = Math.max(2, Math.floor((10 / tz) * lifeRatio));
      if (size <= 0) return;
      const startX = Math.floor(screenX - size / 2);
      const startY = Math.floor(SCREEN_H / 2 - size / 2);
      const g = Math.floor(lifeRatio * 120 + 50);
      const fog = Math.max(0, 1 - tz / MAX_DEPTH);
      if (sprFlameParticle.loaded) {
        ctx.globalAlpha = fog * lifeRatio * 0.85 + 0.05;
        for (let sx = 0; sx < size; sx++) {
          const px = startX + sx;
          if (px < 0 || px >= SCREEN_W || tz >= zBuffer[px]) continue;
          sprFlameParticle.drawColumn(ctx, 0, sx / size, px, startY, size);
        }
        ctx.globalAlpha = 1;
      } else {
        for (let sx = 0; sx < size; sx++) {
          for (let sy = 0; sy < size; sy++) {
            const px = startX + sx, py = startY + sy;
            if (px < 0 || px >= SCREEN_W || py < 0 || py >= SCREEN_H) continue;
            if (tz >= zBuffer[px]) continue;
            const u = sx / size - 0.5, v = sy / size - 0.5;
            if (u * u + v * v > 0.25) continue;
            ctx.globalAlpha = fog * lifeRatio * 0.8;
            ctx.fillStyle = `rgb(255,${g},0)`;
            ctx.fillRect(px, py, 1, 1);
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    function drawEnemySprite(e: Enemy) {
      if (e.type === 3) { drawTargetSprite(e); return; }
      const proj = projectSprite(e.x, e.y);
      if (!proj) return;
      const { screenX, spriteH, spriteW, tz } = proj;
      const startX = Math.floor(screenX - spriteW / 2);
      const startY = Math.floor((SCREEN_H - spriteH) / 2);

      const spr = e.state === 'dead' ? sprEnemyDead : (sprEnemy[e.type] ?? sprEnemy[0]);
      if (spr.loaded) {
        const fog = Math.max(0, 1 - tz / MAX_DEPTH);
        ctx.globalAlpha = fog * 0.85 + 0.15;
        for (let sx = 0; sx < spriteW; sx++) {
          const px = startX + sx;
          if (px < 0 || px >= SCREEN_W) continue;
          if (tz >= zBuffer[px]) continue;
          spr.drawColumn(ctx, 0, sx / spriteW, px, startY, spriteH);
        }
        ctx.globalAlpha = 1;
      } else {
        // Fallback: procedural pixel loop
        const baseColor = ENEMY_COLORS[e.type];
        const isDead = e.state === "dead";
        for (let sx = 0; sx < spriteW; sx++) {
          const px = startX + sx;
          if (px < 0 || px >= SCREEN_W) continue;
          if (tz >= zBuffer[px]) continue;
          const u = sx / spriteW;
          for (let sy = 0; sy < spriteH; sy++) {
            const py = startY + sy;
            if (py < 0 || py >= SCREEN_H) continue;
            const v = sy / spriteH;
            let draw = false;
            let col = baseColor;
            if (isDead) {
              if (v > 0.8) { draw = true; col = "#660000"; }
              else if (v > 0.7 && u > 0.3 && u < 0.7) { draw = true; col = "#440000"; }
            } else {
              if (u > 0.2 && u < 0.8 && v > 0.3 && v < 0.9) { draw = true; col = baseColor; }
              if (u > 0.3 && u < 0.7 && v > 0.05 && v < 0.3) { draw = true; col = "#cc9966"; }
              if (v > 0.1 && v < 0.2) {
                if ((u > 0.35 && u < 0.42) || (u > 0.58 && u < 0.65)) { draw = true; col = "#ff0000"; }
              }
              if (v < 0.05) {
                const hp = e.health / e.maxHealth;
                col = hp > 0.6 ? "#00ff00" : hp > 0.3 ? "#ffff00" : "#ff0000";
                draw = u < hp * 0.6 + 0.2 && u > 0.2;
              }
              if (e.state === "chase" && v < 0.02) { draw = true; col = "#ffff00"; }
            }
            if (draw) {
              const fog = Math.max(0, 1 - tz / MAX_DEPTH);
              ctx.globalAlpha = fog * 0.85 + 0.15;
              ctx.fillStyle = col;
              ctx.fillRect(px, py, 1, 1);
              ctx.globalAlpha = 1;
            }
          }
        }
      }
      // Enemy muzzle flash when they shoot
      if (e.muzzleFlash > 0 && e.state !== "dead") {
        const flashX = startX + Math.floor(spriteW * 0.15);
        const flashY = startY + Math.floor(spriteH * 0.45);
        const flashR = Math.max(2, Math.floor(spriteH * 0.15));
        const falpha = (e.muzzleFlash / 8) * 0.9;
        for (let fdy = -flashR; fdy <= flashR; fdy++) {
          for (let fdx = -flashR; fdx <= flashR; fdx++) {
            const fdist = Math.sqrt(fdx * fdx + fdy * fdy);
            if (fdist > flashR) continue;
            const fpx = flashX + fdx, fpy = flashY + fdy;
            if (fpx < 0 || fpx >= SCREEN_W || fpy < 0 || fpy >= SCREEN_H) continue;
            ctx.globalAlpha = falpha * (1 - fdist / flashR);
            ctx.fillStyle = fdist < flashR * 0.4 ? "#ffffff" : "#ffff00";
            ctx.fillRect(fpx, fpy, 1, 1);
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // ── Target dummy sprite (type 3) — bullseye poster ─────────────────────────
    function drawTargetSprite(e: Enemy) {
      const proj = projectSprite(e.x, e.y);
      if (!proj) return;
      const { screenX, spriteH, spriteW, tz } = proj;
      const startX = Math.floor(screenX - spriteW / 2);
      const startY = Math.floor((SCREEN_H - spriteH) / 2);
      const hp = e.health / e.maxHealth;
      const isDead = e.state === "dead";

      const spr = isDead ? sprTargetDead : sprTarget;
      if (spr.loaded) {
        const fog = Math.max(0, 1 - tz / MAX_DEPTH);
        ctx.globalAlpha = fog * 0.85 + 0.15;
        for (let sx = 0; sx < spriteW; sx++) {
          const px = startX + sx;
          if (px < 0 || px >= SCREEN_W) continue;
          if (tz >= zBuffer[px]) continue;
          spr.drawColumn(ctx, 0, sx / spriteW, px, startY, spriteH);
        }
        ctx.globalAlpha = 1;
      } else {
        // Fallback: procedural
        for (let sx = 0; sx < spriteW; sx++) {
          const px = startX + sx;
          if (px < 0 || px >= SCREEN_W) continue;
          if (tz >= zBuffer[px]) continue;
          const u = sx / spriteW;

          for (let sy = 0; sy < spriteH; sy++) {
            const py = startY + sy;
            if (py < 0 || py >= SCREEN_H) continue;
            const v = sy / spriteH;

            let col = "";
            let draw = false;

            if (isDead) {
              if (v > 0.75 && u > 0.15 && u < 0.85) {
                draw = true;
                col = v > 0.9 ? "#3a1a08" : "#6B3010";
              }
            } else {
              const cx2 = (u - 0.5) * 2;
              const cy2 = (v - 0.5) * 2;
              const r = Math.sqrt(cx2 * cx2 + cy2 * cy2);

              if (r <= 1.0) {
                draw = true;
                if      (r < 0.15) col = "#ff2200";
                else if (r < 0.35) col = "#f5f0e0";
                else if (r < 0.55) col = "#cc1100";
                else if (r < 0.75) col = "#e8e4d0";
                else               col = "#c8b888";

                if (hp < 0.75) {
                  const n = Math.sin(u * 37.1 + v * 19.3) * Math.sin(u * 13.7 - v * 41.1);
                  const noise = n * 0.5 + 0.5;
                  if (noise < (0.75 - hp) * 0.55) col = "#0d0404";
                }
              }

              if (v < 0.05 && u > 0.1 && u < 0.9) {
                const frac = (u - 0.1) / 0.8;
                draw = true;
                col = frac < hp
                  ? (hp > 0.6 ? "#22ff44" : hp > 0.3 ? "#ffaa00" : "#ff2200")
                  : "#2a2a2a";
              }
            }

            if (draw) {
              const fog = Math.max(0, 1 - tz / MAX_DEPTH);
              ctx.globalAlpha = fog * 0.85 + 0.15;
              ctx.fillStyle = col;
              ctx.fillRect(px, py, 1, 1);
              ctx.globalAlpha = 1;
            }
          }
        }
      }
    }

    function drawPickupSprite(p: Pickup) {
      const proj = projectSprite(p.x, p.y);
      if (!proj) return;
      const { screenX, spriteH, tz } = proj;
      const size = Math.floor(spriteH * 0.4);
      const startX = Math.floor(screenX - size / 2);
      const startY = Math.floor(SCREEN_H / 2 + spriteH * 0.05);

      const spr = p.type === 'health' ? sprPickupHealth
        : p.type === 'bullets' || p.type === 'ammo' ? sprPickupBullets
        : p.type === 'balls' ? sprPickupBalls
        : p.type === 'fuel' ? sprPickupFuel
        : p.type === 'weapon-woofer' ? sprPickupWoofer
        : p.type === 'weapon-tennis' ? sprPickupTennis
        : p.type === 'weapon-flamethrower' ? sprPickupFlame
        : p.type.startsWith('key-') ? sprKeys[p.type.slice(4) as KeyColor]
        : sprPickupAmmo;
      if (spr.loaded) {
        const fog = Math.max(0, 1 - tz / MAX_DEPTH);
        ctx.globalAlpha = fog * 0.85 + 0.15;
        for (let sx = 0; sx < size; sx++) {
          const px = startX + sx;
          if (px < 0 || px >= SCREEN_W) continue;
          if (tz >= zBuffer[px]) continue;
          spr.drawColumn(ctx, 0, sx / size, px, startY, size);
        }
        ctx.globalAlpha = 1;
      } else {
        // Fallback: procedural
        const col = p.type === 'health' ? '#00cc44'
          : p.type.startsWith('weapon-') ? '#ff6600'
          : p.type === 'fuel' ? '#cc2200'
          : p.type === 'balls' ? '#88aa00'
          : p.type.startsWith('key-') ? (() => { const [r,g,b]=KEY_HEX[p.type.slice(4) as KeyColor]; return `rgb(${r},${g},${b})`; })()
          : '#ffaa00';
        for (let sx = 0; sx < size; sx++) {
          for (let sy = 0; sy < size; sy++) {
            const px = startX + sx, py = startY + sy;
            if (px < 0 || px >= SCREEN_W || py < 0 || py >= SCREEN_H) continue;
            if (tz >= zBuffer[px]) continue;
            const u = sx / size, v = sy / size;
            const cx = Math.abs(u - 0.5) * 2, cy = Math.abs(v - 0.5) * 2;
            if (cx * cx + cy * cy < 0.8) {
              const fog = Math.max(0, 1 - tz / MAX_DEPTH);
              ctx.globalAlpha = fog * 0.85 + 0.15;
              ctx.fillStyle = col;
              ctx.fillRect(px, py, 1, 1);
              ctx.globalAlpha = 1;
            }
          }
        }
      }
    }

    // ── Weapon rendering ───────────────────────────────────────────────────────
    function drawWeapon() {
      ctx.imageSmoothingEnabled = false;
      const recoil = Math.round(gunRecoil * 10);
      const gw = 24, gh = 48;
      const dx = Math.floor(SCREEN_W / 2) - gw / 2;
      // switchProgress 0=visible, 1=fully lowered off-screen
      const switchOffset = Math.round(switchProgress * (gh + 24));
      const dy = SCREEN_H - gh + 18 + recoil + switchOffset;

      const spr = sprWeapon[currentWeapon];
      if (spr && spr.loaded) {
        spr.draw(ctx, 0, dx, dy, gw, gh);
      } else {
        // Procedural fallback for current weapon
        const cx = Math.floor(SCREEN_W / 2);
        const cy = SCREEN_H + 4 + recoil + switchOffset;
        if (currentWeapon === 'claws') {
          ctx.fillStyle = '#382212'; ctx.fillRect(cx - 14, cy - 38, 10, 28); ctx.fillRect(cx + 4, cy - 38, 10, 28);
          ctx.fillStyle = '#e8dcc8';
          for (let j = 0; j < 3; j++) { ctx.fillRect(cx - 12 + j * 4, cy - 52, 3, 16); ctx.fillRect(cx + 6 + j * 4, cy - 52, 3, 16); }
        } else if (currentWeapon === 'flamethrower') {
          ctx.fillStyle = '#bb3a0e'; ctx.fillRect(cx + 2, cy - 42, 12, 36);
          ctx.fillStyle = '#6e6458'; ctx.fillRect(cx - 12, cy - 32, 14, 10);
          ctx.fillStyle = '#ff8800'; ctx.fillRect(cx - 14, cy - 28, 4, 6);
        } else {
          ctx.fillStyle = '#777'; ctx.fillRect(cx - 3, cy - 40, 6, 30);
          ctx.fillStyle = '#555'; ctx.fillRect(cx - 4, cy - 42, 8, 4);
          ctx.fillStyle = '#666'; ctx.fillRect(cx - 12, cy - 16, 24, 16);
          ctx.fillStyle = '#3a2a18'; ctx.fillRect(cx - 9, cy - 2, 18, 20);
          if (currentWeapon === 'woofer') { ctx.fillStyle = '#3a2a08'; ctx.fillRect(cx - 8, cy + 16, 14, 10); }
        }
      }

      const isGun = currentWeapon === 'subwoofer' || currentWeapon === 'woofer';
      if (muzzleFlashTimer > 0 && isGun) drawMuzzleFlash(Math.floor(SCREEN_W / 2), dy + 2, muzzleFlashTimer);
    }

    function drawMuzzleFlash(cx: number, cy: number, t: number) {
      const alpha = Math.min(1, t / 6);
      const maxR = 9;
      for (let fdy = -maxR; fdy <= maxR; fdy++) {
        for (let fdx = -maxR; fdx <= maxR; fdx++) {
          const r = Math.sqrt(fdx * fdx + fdy * fdy);
          if (r > maxR) continue;
          const ang = Math.atan2(fdy, fdx);
          const star = Math.abs(Math.cos(ang * 4)) * 0.7 + 0.3;
          if (r > maxR * star) continue;
          const fpx = cx + fdx, fpy = cy + fdy;
          if (fpx < 0 || fpx >= SCREEN_W || fpy < 0 || fpy >= SCREEN_H) continue;
          const col = r < 2 ? "#ffffff" : r < 4 ? "#ffff88" : r < 7 ? "#ffaa00" : "#ff4400";
          ctx.globalAlpha = alpha * (1 - r / maxR) * 0.95;
          ctx.fillStyle = col;
          ctx.fillRect(fpx, fpy, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawImpacts() {
      for (let i = impacts.length - 1; i >= 0; i--) {
        const imp = impacts[i];
        imp.timer--;
        if (imp.timer <= 0) { impacts.splice(i, 1); continue; }
        const t = imp.timer / imp.maxTimer;

        if (imp.type === 'claws' || imp.type === 'claws-miss') {
          // Swipe lines: 3 diagonal parallel scratches
          const hit = imp.type === 'claws';
          const cx2 = imp.sx, cy2 = imp.sy;
          const len = hit ? 28 : 18;
          const gap = hit ? 5 : 4;
          ctx.globalAlpha = t * 0.92;
          // Slash direction: top-left to bottom-right, 3 parallel lines
          for (let li = -1; li <= 1; li++) {
            const ox2 = li * gap, oy2 = -li * gap;
            // Each line drawn as thick pixel stroke
            const steps = len;
            for (let s = 0; s < steps; s++) {
              const frac = s / steps;
              const px = Math.floor(cx2 + ox2 + (frac - 0.5) * len);
              const py = Math.floor(cy2 + oy2 + (frac - 0.5) * len);
              if (px < 0 || px >= SCREEN_W || py < 0 || py >= SCREEN_H) continue;
              const edge = Math.min(frac, 1 - frac) * 2;
              ctx.globalAlpha = t * edge * (hit ? 0.95 : 0.6);
              ctx.fillStyle = hit ? '#ff6600' : '#cc8844';
              ctx.fillRect(px, py, 2, 2);
            }
          }
          ctx.globalAlpha = 1;
          continue;
        }

        const spr = imp.type === 'wall' ? sprImpactWall : sprImpactEnemy;
        const size = 16;
        ctx.globalAlpha = t * 0.9;
        if (spr.loaded) {
          spr.draw(ctx, 0, imp.sx - size / 2, imp.sy - size / 2, size, size);
        } else {
          // Fallback: procedural circle
          const r = Math.floor((1 - t) * 14 + 2);
          const col = imp.type === "wall" ? "#888" : "#dd1111";
          for (let idy = -r; idy <= r; idy++) {
            for (let idx = -r; idx <= r; idx++) {
              const dist = Math.sqrt(idx * idx + idy * idy);
              if (dist > r) continue;
              const ipx = imp.sx + idx, ipy = imp.sy + idy;
              if (ipx < 0 || ipx >= SCREEN_W || ipy < 0 || ipy >= SCREEN_H) continue;
              ctx.globalAlpha = t * (1 - dist / r) * 0.85;
              ctx.fillStyle = col;
              ctx.fillRect(ipx, ipy, 1, 1);
            }
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // ── Minimap ────────────────────────────────────────────────────────────────
    function renderMap() {
      const MSCALE = 2;
      mapCtx.fillStyle = "rgba(0,0,0,0.85)";
      mapCtx.fillRect(0, 0, 80, 80);
      const ox = Math.floor(player.x / CELL) - 20;
      const oy = Math.floor(player.y / CELL) - 20;
      for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 40; x++) {
          const mx = ox + x, my = oy + y;
          if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) continue;
          const tile = map[my][mx];
          if (tile === TILE_WALL) mapCtx.fillStyle = "#555";
          else if (tile === TILE_LAVA) mapCtx.fillStyle = "#882200";
          else if (tile === TILE_WINDOW) mapCtx.fillStyle = "#2a2a1a";
          else if (tile === TILE_EXIT) mapCtx.fillStyle = "#ffdd00";
          else if (tile === TILE_DOOR) mapCtx.fillStyle = "#8b6914";
          else if (isDoorTile(tile)) { const [r,g,b] = KEY_HEX[KEY_COLORS[tile-TILE_DOOR_RED]]; mapCtx.fillStyle = `rgb(${Math.floor(r*0.7)},${Math.floor(g*0.7)},${Math.floor(b*0.7)})`; }
          else mapCtx.fillStyle = "#1a0a00";
          mapCtx.fillRect(x * MSCALE, y * MSCALE, MSCALE, MSCALE);
        }
      }
      for (const e of enemies) {
        if (e.state === "dead") continue;
        const ex = Math.floor(e.x / CELL) - ox;
        const ey = Math.floor(e.y / CELL) - oy;
        if (ex >= 0 && ex < 40 && ey >= 0 && ey < 40) {
          mapCtx.fillStyle = "#ff3300";
          mapCtx.fillRect(ex * MSCALE, ey * MSCALE, MSCALE, MSCALE);
        }
      }
      const px = 20, py = 20;
      mapCtx.fillStyle = "#00ffff";
      mapCtx.fillRect(px * MSCALE - 1, py * MSCALE - 1, 3, 3);
      mapCtx.strokeStyle = "#00ffff";
      mapCtx.lineWidth = 1;
      mapCtx.beginPath();
      mapCtx.moveTo(px * MSCALE, py * MSCALE);
      mapCtx.lineTo(px * MSCALE + Math.cos(player.angle) * 5, py * MSCALE + Math.sin(player.angle) * 5);
      mapCtx.stroke();
    }

    // ── Full Map ───────────────────────────────────────────────────────────────
    function renderFullMap() {
      ctx.fillStyle = "rgba(0,0,0,0.92)";
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

      const scale = Math.min((SCREEN_W - 8) / MAP_W, (SCREEN_H - 16) / MAP_H);
      const offsetX = (SCREEN_W - MAP_W * scale) / 2;
      const offsetY = (SCREEN_H - MAP_H * scale) / 2 + 6;

      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          const tile = map[y][x];
          if (tile === TILE_WALL) { ctx.fillStyle = "#3a1a00"; }
          else if (tile === TILE_LAVA) { ctx.fillStyle = "#661100"; }
          else if (tile === TILE_WINDOW) { ctx.fillStyle = "#1a1a0d"; }
          else if (tile === TILE_EXIT) { ctx.fillStyle = "#ffdd00"; }
          else if (tile === TILE_DOOR) { ctx.fillStyle = "#8b6914"; }
          else if (isDoorTile(tile)) { const [r,g,b] = KEY_HEX[KEY_COLORS[tile-TILE_DOOR_RED]]; ctx.fillStyle = `rgb(${r},${g},${b})`; }
          else { ctx.fillStyle = "#110800"; }
          ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
        }
      }

      // Enemies
      for (const e of enemies) {
        if (e.state === "dead") continue;
        const ex = e.x / CELL, ey = e.y / CELL;
        ctx.fillStyle = "#ff3300";
        ctx.fillRect(offsetX + ex * scale - 1, offsetY + ey * scale - 1, 2, 2);
      }

      // Player
      const px = player.x / CELL, py = player.y / CELL;
      ctx.fillStyle = "#00ffff";
      ctx.fillRect(offsetX + px * scale - 1.5, offsetY + py * scale - 1.5, 3, 3);
      ctx.strokeStyle = "#00ffff"; ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(offsetX + px * scale, offsetY + py * scale);
      ctx.lineTo(offsetX + (px + Math.cos(player.angle) * 3) * scale, offsetY + (py + Math.sin(player.angle) * 3) * scale);
      ctx.stroke();

      // Label
      ctx.fillStyle = "#c00";
      ctx.font = "7px 'Share Tech Mono', monospace";
      const levelLabel = level === 1 ? "TRAINING" : `LVL ${level}  SEED:${seed}`;
      ctx.fillText(`[ M ] CLOSE MAP  ·  ${levelLabel}`, offsetX, offsetY - 3);
    }

    // ── HUD ────────────────────────────────────────────────────────────────────
    function updateHUD() {
      const hHealth = q<HTMLElement>("#hz-hud-health");
      hHealth.textContent = String(Math.max(0, Math.ceil(player.health)));
      hHealth.className = "hz-hud-value" + (player.health <= 20 ? " low" : "");
      // Weapon slots
      for (const slot of WEAPON_SLOT_DATA) {
        const slotEl = root.querySelector<HTMLElement>(`#hz-wslot-${slot.id}`);
        const ammoEl = root.querySelector<HTMLElement>(`#hz-wslot-ammo-${slot.id}`);
        if (!slotEl || !ammoEl) continue;
        const owned = ownedWeapons.has(slot.id);
        const active = currentWeapon === slot.id && switchState === 'idle';
        slotEl.className = `hz-weapon-slot${active ? ' active' : ''}${!owned ? ' unowned' : ''}`;
        if (!owned) { ammoEl.textContent = '×'; }
        else if (slot.id === 'claws' || infAmmo) { ammoEl.textContent = '∞'; }
        else if (slot.id === 'subwoofer' || slot.id === 'woofer') {
          ammoEl.textContent = String(player.ammo);
          ammoEl.className = 'hz-wslot-ammo' + (player.ammo <= 5 && (slot.id === currentWeapon) ? ' low' : '');
        } else if (slot.id === 'tennis') { ammoEl.textContent = String(ballAmmo); }
        else if (slot.id === 'flamethrower') { ammoEl.textContent = String(fuelAmmo); }
      }
      drawFace();
    }

    function drawFace() {
      faceCtx.fillStyle = "#1a0a00";
      faceCtx.fillRect(0, 0, 24, 24);
      const hp = player.health / 100;
      const skinCol = hp > 0.5 ? "#cc9966" : hp > 0.25 ? "#bb7744" : "#aa4422";
      faceCtx.fillStyle = skinCol; faceCtx.fillRect(5, 3, 14, 14);
      faceCtx.fillStyle = "#442200"; faceCtx.fillRect(5, 3, 14, 4);
      faceCtx.fillStyle = hp > 0.25 ? "#ffffff" : "#ffaaaa";
      faceCtx.fillRect(7, 8, 3, 3); faceCtx.fillRect(14, 8, 3, 3);
      faceCtx.fillStyle = hp > 0.5 ? "#224488" : "#ff0000";
      faceCtx.fillRect(8, 9, 2, 2); faceCtx.fillRect(15, 9, 2, 2);
      if (hp > 0.5) { faceCtx.fillStyle = "#cc4444"; faceCtx.fillRect(8, 14, 8, 2); }
      else          { faceCtx.fillStyle = "#880000"; faceCtx.fillRect(7, 14, 10, 3); }
      faceCtx.fillStyle = "#336633"; faceCtx.fillRect(4, 17, 16, 7);
      if (hp < 0.5) { faceCtx.fillStyle = `rgba(200,0,0,${0.5 - hp})`; faceCtx.fillRect(5, 3, 14, 21); }
    }

    // ── Movement helpers ───────────────────────────────────────────────────────
    function canMove(x: number, y: number, margin: number) {
      const pts = [[x - margin, y - margin], [x + margin, y - margin], [x - margin, y + margin], [x + margin, y + margin]];
      for (const [cx, cy] of pts) {
        const tx = Math.floor(cx / CELL), ty = Math.floor(cy / CELL);
        if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return false;
        if (isSolid(map[ty][tx])) return false;
      }
      return true;
    }

    // Lava and window bars are physically solid; only empty floor and exits are passable.
    // Closed doors (TILE_DOOR*) are also solid; they become TILE_EMPTY when fully open.
    function isSolid(t: number) { return t === TILE_WALL || t === TILE_LAVA || t === TILE_WINDOW || isDoorTile(t); }
    // Closed doors block enemy LOS; windows do not (bars are transparent to bullets/sight).
    function blocksLOS(t: number) { return t === TILE_WALL || t === TILE_LAVA || isDoorTile(t); }

    function approach(current: number, target: number, delta: number): number {
      if (Math.abs(target - current) <= delta) return target;
      return current + Math.sign(target - current) * delta;
    }

    function movePlayer(dt: number) {
      const shifting = keys['ShiftLeft'] || keys['ShiftRight'];
      sprinting = capsLocked ? !shifting : shifting;
      const speedMult = sprinting ? SPRINT_MULT : 1.0;
      const maxSpeed = PLAYER_SPEED * speedMult;
      const maxAngSpeed = TURN_SPEED * speedMult * 60;

      // Target velocity from input
      let targetVX = 0, targetVY = 0;
      if (keys['KeyW'] || keys['ArrowUp'])   { targetVX += Math.cos(player.angle) * maxSpeed; targetVY += Math.sin(player.angle) * maxSpeed; }
      if (keys['KeyS'] || keys['ArrowDown']) { targetVX -= Math.cos(player.angle) * maxSpeed; targetVY -= Math.sin(player.angle) * maxSpeed; }
      if (keys['KeyA']) { targetVX += Math.cos(player.angle - Math.PI/2) * maxSpeed; targetVY += Math.sin(player.angle - Math.PI/2) * maxSpeed; }
      if (keys['KeyD']) { targetVX += Math.cos(player.angle + Math.PI/2) * maxSpeed; targetVY += Math.sin(player.angle + Math.PI/2) * maxSpeed; }

      // Smooth velocity toward target
      const accelStep = MOVE_ACCEL * dt;
      player.velX = approach(player.velX, targetVX, accelStep);
      player.velY = approach(player.velY, targetVY, accelStep);

      // Apply movement with collision
      const margin = 10;
      const nx = player.x + player.velX, ny = player.y + player.velY;
      if (canMove(nx, player.y, margin)) player.x = nx;
      else player.velX = 0;
      if (canMove(player.x, ny, margin)) player.y = ny;
      else player.velY = 0;

      // Turning inertia (arrow keys only; mouse is direct)
      let targetAngVel = 0;
      if (keys['ArrowLeft'])  targetAngVel = -maxAngSpeed;
      if (keys['ArrowRight']) targetAngVel =  maxAngSpeed;
      const turnStep = TURN_ACCEL * dt;
      player.angVel = approach(player.angVel, targetAngVel, turnStep);
      player.angle += player.angVel * dt;

      // Pickups
      for (const p of pickups) {
        if (p.taken) continue;
        if (Math.hypot(p.x - player.x, p.y - player.y) < CELL * 0.5) {
          p.taken = true;
          if (p.type === 'health') {
            player.health = Math.min(100, player.health + 25); fireQuip('pickup_health'); playSound('pickup');
          } else if (p.type === 'ammo' || p.type === 'bullets') {
            player.ammo = Math.min(99, player.ammo + 20); fireQuip('pickup_ammo_bullets'); playSound('pickup');
          } else if (p.type === 'balls') {
            ballAmmo = Math.min(50, ballAmmo + 10); fireQuip('pickup_ammo_balls'); playSound('pickup');
          } else if (p.type === 'fuel') {
            fuelAmmo = Math.min(99, fuelAmmo + 30); fireQuip('pickup_ammo_fuel'); playSound('pickup');
          } else if (p.type.startsWith('key-')) {
            const kc = p.type.slice(4) as KeyColor;
            heldKeys.add(kc);
            showMessage(`+ ${kc.toUpperCase()} KEY`);
            playSound('pickup');
          } else if (p.type.startsWith('weapon-')) {
            const wId = p.type.slice(7) as WeaponId;
            if (!ownedWeapons.has(wId)) {
              ownedWeapons.add(wId);
              if (wId === 'tennis') ballAmmo = Math.min(50, ballAmmo + 10);
              if (wId === 'flamethrower') fuelAmmo = Math.min(99, fuelAmmo + 40);
              if (wId === 'woofer') player.ammo = Math.min(99, player.ammo + 20);
              const wqKey: QuipKey = wId === 'woofer' ? 'pickup_weapon_woofer'
                : wId === 'tennis' ? 'pickup_weapon_tennis'
                : wId === 'flamethrower' ? 'pickup_weapon_flamethrower'
                : 'pickup_weapon';
              fireQuip(wqKey);
              playSound('pickup-weapon');
              switchWeapon(wId);
            } else {
              if (wId === 'woofer') { player.ammo = Math.min(99, player.ammo + 15); fireQuip('pickup_ammo_bullets'); }
              else if (wId === 'tennis') { ballAmmo = Math.min(50, ballAmmo + 8); fireQuip('pickup_ammo_balls'); }
              else if (wId === 'flamethrower') { fuelAmmo = Math.min(99, fuelAmmo + 25); fireQuip('pickup_ammo_fuel'); }
              playSound('pickup');
            }
          }
        }
      }

      // Exit tile
      const tileX = Math.floor(player.x / CELL), tileY = Math.floor(player.y / CELL);
      if (map[tileY] && map[tileY][tileX] === TILE_EXIT) setScreen("clear");
    }

    // ── Shooting ───────────────────────────────────────────────────────────────
    function hasLOS(x0: number, y0: number, x1: number, y1: number) {
      for (let i = 1; i < 20; i++) {
        const t = i / 20;
        const tx = Math.floor((x0 + (x1 - x0) * t) / CELL);
        const ty = Math.floor((y0 + (y1 - y0) * t) / CELL);
        if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return false;
        if (blocksLOS(map[ty][tx])) return false;
      }
      return true;
    }

    function tryFire() {
      if (switchState !== 'idle' || shootCooldown > 0) return;
      switch (currentWeapon) {
        case 'claws': fireMelee(); break;
        case 'subwoofer': fireRaycast('subwoofer'); break;
        case 'woofer':    fireRaycast('woofer'); break;
        case 'tennis':    fireTennisLauncher(); break;
        case 'flamethrower': fireFlamethrower(); break;
      }
    }

    function fireMelee() {
      shootCooldown = WEAPON_DEFS.claws.cooldown;
      gunRecoil = 0.6;
      playSound('swipe-claws');
      let hit = false;
      for (const e of enemies) {
        if (e.state === 'dead') continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1.5 * CELL) continue;
        let angleDiff = Math.atan2(dy, dx) - player.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) > Math.PI / 4) continue;
        const damage = WEAPON_DEFS.claws.minDmg + Math.floor(Math.random() * (WEAPON_DEFS.claws.maxDmg - WEAPON_DEFS.claws.minDmg));
        e.health -= damage; e.state = 'chase'; hit = true;
        playSound('hit-claws', 0.8);
        const sp = projectSprite(e.x, e.y);
        impacts.push({ sx: sp ? sp.screenX : SCREEN_W / 2, sy: Math.floor(SCREEN_H * 0.45), type: 'claws', timer: 10, maxTimer: 10 });
        if (e.health <= 0) { e.state = 'dead'; kills++; signalCombat(); queueQuip('enemy_killed', 'enemy_killed_claws'); }
      }
      if (!hit) impacts.push({ sx: SCREEN_W / 2, sy: SCREEN_H / 2, type: 'claws-miss', timer: 7, maxTimer: 7 });
    }

    function fireRaycast(wId: 'subwoofer' | 'woofer') {
      if (!infAmmo && player.ammo <= 0) { fireQuip('player_no_ammo_bullets'); return; }
      if (!infAmmo) player.ammo--;
      shootCooldown = WEAPON_DEFS[wId].cooldown;
      gunRecoil = 1.0; muzzleFlashTimer = 8;
      playSound(wId === 'subwoofer' ? 'shoot-subwoofer' : 'shoot-woofer');
      let nearest: Enemy | null = null, nearDist = Infinity;
      for (const e of enemies) {
        if (e.state === 'dead') continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let angleDiff = Math.atan2(dy, dx) - player.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const spriteAngularWidth = Math.atan2(CELL * 0.4, dist);
        if (Math.abs(angleDiff) < spriteAngularWidth + 0.04 && dist < nearDist && hasLOS(player.x, player.y, e.x, e.y)) {
          nearest = e; nearDist = dist;
        }
      }
      const def = WEAPON_DEFS[wId];
      if (nearest) {
        const damage = def.minDmg + Math.floor(Math.random() * (def.maxDmg - def.minDmg));
        nearest.health -= damage; nearest.state = 'chase';
        const sp = projectSprite(nearest.x, nearest.y);
        impacts.push({ sx: sp ? sp.screenX : SCREEN_W / 2, sy: Math.floor(SCREEN_H * 0.45), type: 'enemy', timer: 12, maxTimer: 12 });
        playSound('hit-enemy');
        if (nearest.health <= 0) { nearest.state = 'dead'; kills++; signalCombat(); queueQuip('enemy_killed', wId === 'subwoofer' ? 'enemy_killed_subwoofer' : 'enemy_killed_woofer'); }
      } else {
        impacts.push({ sx: SCREEN_W / 2, sy: SCREEN_H / 2, type: 'wall', timer: 10, maxTimer: 10 });
        playSound('hit-wall');
      }
    }

    function fireTennisLauncher() {
      if (!infAmmo && ballAmmo <= 0) { fireQuip('player_no_ammo_balls'); return; }
      if (!infAmmo) ballAmmo--;
      shootCooldown = WEAPON_DEFS.tennis.cooldown;
      gunRecoil = 1.2;
      playSound('shoot-tennis');
      const speed = 0.14 * CELL;
      const def = WEAPON_DEFS.tennis;
      projectiles.push({
        x: player.x, y: player.y,
        velX: Math.cos(player.angle) * speed,
        velY: Math.sin(player.angle) * speed,
        damage: def.minDmg + Math.floor(Math.random() * (def.maxDmg - def.minDmg)),
        age: 0, maxAge: 360,
      });
    }

    function fireFlamethrower() {
      if (!infAmmo && fuelAmmo <= 0) { fireQuip('player_no_ammo_fuel'); return; }
      if (!infAmmo) fuelAmmo--;
      shootCooldown = WEAPON_DEFS.flamethrower.cooldown;
      playSound('shoot-flamethrower', 0.25);
      const coneHalf = Math.PI / 9; // ±20° — tight cone
      const maxRange = 7 * CELL;
      // Instant cone damage check — ignite everything in the cone
      for (const e of enemies) {
        if (e.state === 'dead') continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRange) continue;
        let angleDiff = Math.atan2(dy, dx) - player.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) > coneHalf) continue;
        if (!hasLOS(player.x, player.y, e.x, e.y)) continue;
        e.burning = true;
        e.burnTimer = Math.max(e.burnTimer, 180);
        e.burnDamage = WEAPON_DEFS.flamethrower.minDmg + Math.floor(Math.random() * (WEAPON_DEFS.flamethrower.maxDmg - WEAPON_DEFS.flamethrower.minDmg));
        if (e.state !== 'chase') { e.state = 'chase'; playSound('alert', 0.5); }
        const sp = projectSprite(e.x, e.y);
        impacts.push({ sx: sp ? sp.screenX : SCREEN_W / 2, sy: Math.floor(SCREEN_H * 0.45), type: 'enemy', timer: 8, maxTimer: 8 });
      }
      // Spawn visual-only particles along the tight cone
      for (let i = 0; i < 4; i++) {
        const spread = (Math.random() - 0.5) * coneHalf * 2;
        const pAngle = player.angle + spread;
        const speed = (0.06 + Math.random() * 0.04) * CELL;
        flameParticles.push({
          x: player.x + Math.cos(player.angle) * CELL * 0.4,
          y: player.y + Math.sin(player.angle) * CELL * 0.4,
          velX: Math.cos(pAngle) * speed, velY: Math.sin(pAngle) * speed,
          age: 0, maxAge: 20 + Math.floor(Math.random() * 15),
          damage: 0, // visual only; damage is handled by the cone check above
        });
      }
    }

    function updateProjectiles(dt: number) {
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.age++;
        if (p.age > 90) p.damage *= 0.97;
        const newX = p.x + p.velX * dt * 60;
        const newY = p.y + p.velY * dt * 60;
        const tx = Math.floor(newX / CELL), ty = Math.floor(newY / CELL);
        const oldTx = Math.floor(p.x / CELL);
        if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) { projectiles.splice(i, 1); continue; }
        if (isSolid(map[ty][tx])) {
          if (tx !== oldTx) p.velX = -p.velX * 0.72; else p.velY = -p.velY * 0.72;
          p.damage *= 0.7;
          playSound('bounce-tennis', 0.45);
          if (p.damage < 2) { projectiles.splice(i, 1); continue; }
        } else {
          p.x = newX; p.y = newY;
        }
        if (p.age >= p.maxAge) { projectiles.splice(i, 1); continue; }
        for (const e of enemies) {
          if (e.state === 'dead') continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < CELL * 0.45) {
            const dmg = Math.max(1, Math.floor(p.damage));
            e.health -= dmg; e.state = 'chase';
            p.damage *= 0.55;
            const sp = projectSprite(e.x, e.y);
            impacts.push({ sx: sp ? sp.screenX : SCREEN_W / 2, sy: Math.floor(SCREEN_H * 0.45), type: 'enemy', timer: 8, maxTimer: 8 });
            playSound('bounce-tennis', 0.65);
            if (e.health <= 0) { e.state = 'dead'; kills++; signalCombat(); queueQuip('enemy_killed', 'enemy_killed_tennis'); }
            if (p.damage < 2) { projectiles.splice(i, 1); break; }
          }
        }
      }
    }

    function updateFlameParticles(dt: number) {
      for (let i = flameParticles.length - 1; i >= 0; i--) {
        const fp = flameParticles[i];
        fp.age++;
        fp.x += fp.velX * dt * 60; fp.y += fp.velY * dt * 60;
        const tx = Math.floor(fp.x / CELL), ty = Math.floor(fp.y / CELL);
        if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H || isSolid(map[ty][tx])) {
          flameParticles.splice(i, 1); continue;
        }
        if (fp.age >= fp.maxAge) { flameParticles.splice(i, 1); continue; }
      }
    }

    // ── Enemy AI ───────────────────────────────────────────────────────────────
    function updateEnemies(dt: number) {
      for (const e of enemies) {
        if (e.state === "dead") continue;
        // Burning DoT
        if (e.burning && e.burnTimer > 0) {
          e.burnTimer -= dt * 60;
          e.health -= e.burnDamage * dt;
          if (e.burnTimer <= 0) { e.burning = false; e.burnTimer = 0; }
          if (e.health <= 0) { e.state = 'dead'; kills++; signalCombat(); queueQuip('enemy_killed', 'enemy_killed_flamethrower'); }
        }
        if (e.state === "dead") continue;
        if (e.type === 3) continue;

        const dx = player.x - e.x, dy = player.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (level === 1) {
          e.x += Math.cos(e.angle) * 0.5;
          e.y += Math.sin(e.angle) * 0.5;
          if (Math.random() < 0.01) e.angle += (Math.random() - 0.5) * 1.5;
          const tx = Math.floor(e.x / CELL), ty = Math.floor(e.y / CELL);
          if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H || isSolid(map[ty][tx])) {
            e.x -= Math.cos(e.angle) * 0.5;
            e.y -= Math.sin(e.angle) * 0.5;
            e.angle += Math.PI / 2;
          }
          continue;
        }

        if (e.state === "idle") {
          if (dist < e.alertRange && hasLOS(e.x, e.y, player.x, player.y)) {
            e.state = "chase";
            playSound('alert');
          }
          e.x += Math.cos(e.angle) * 0.3;
          e.y += Math.sin(e.angle) * 0.3;
          if (Math.random() < 0.01) e.angle += (Math.random() - 0.5) * 1.5;
          const tx = Math.floor(e.x / CELL), ty = Math.floor(e.y / CELL);
          if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H || isSolid(map[ty][tx])) {
            e.x -= Math.cos(e.angle) * 0.3;
            e.y -= Math.sin(e.angle) * 0.3;
            e.angle += Math.PI / 2;
          }
        }
        if (e.state === "chase") {
          const spd = [1.0, 0.7, 1.5][e.type] * dt * 60;
          const angleToPlayer = Math.atan2(dy, dx);
          const nx = e.x + Math.cos(angleToPlayer) * spd;
          const ny = e.y + Math.sin(angleToPlayer) * spd;
          const tx = Math.floor(nx / CELL), ty = Math.floor(ny / CELL);
          if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H && !isSolid(map[ty][tx])) {
            e.x = nx; e.y = ny;
          } else {
            const nx2 = e.x + Math.cos(angleToPlayer) * spd;
            const tx2 = Math.floor(nx2 / CELL), ty2 = Math.floor(e.y / CELL);
            if (tx2 >= 0 && tx2 < MAP_W && ty2 >= 0 && ty2 < MAP_H && !isSolid(map[ty2][tx2])) e.x = nx2;
            const ny2 = e.y + Math.sin(angleToPlayer) * spd;
            const tx3 = Math.floor(e.x / CELL), ty3 = Math.floor(ny2 / CELL);
            if (tx3 >= 0 && tx3 < MAP_W && ty3 >= 0 && ty3 < MAP_H && !isSolid(map[ty3][tx3])) e.y = ny2;
          }
          if (e.muzzleFlash > 0) e.muzzleFlash = Math.max(0, e.muzzleFlash - dt * 60);
          e.shootTimer -= dt * 60;
          if (e.shootTimer <= 0 && dist < 8 * CELL && hasLOS(e.x, e.y, player.x, player.y)) {
            const dmg = [8, 15, 5][e.type];
            e.muzzleFlash = 8;
            e.shootTimer = [80, 120, 50][e.type] + Math.random() * 60;
            if (!godMode) {
              player.health -= dmg + Math.random() * 5;
              flashTimer = 12;
              signalCombat();
              if (hurtCooldown <= 0) {
                playSound('hurt');
                hurtCooldown = 45;
                queueQuip('player_hurt');
              }
              if (player.health <= 0) {
                player.health = 0;
                playSound('death');
                fireQuip('player_death');
                const stats = q("#hz-death-stats");
                stats.innerHTML = `LEVEL: ${level}<br>KILLS: ${kills} / ${totalKills}<br>BULLETS: ${player.ammo} | BALLS: ${ballAmmo} | FUEL: ${fuelAmmo}`;
                setScreen("dead");
                if (document.pointerLockElement) document.exitPointerLock();
              }
            }
          }
        }
      }
    }

    // ── Messages / subtitles ───────────────────────────────────────────────────
    // category controls subtitle color and toggleability.
    // _audio is reserved for recorded voice clips; wired now, populated later.
    function showMessage(text: string, category: SubtitleCategory = 'info', _audio?: string) {
      if (category === 'player' && !subtitleSettings.player) return;
      if (category === 'monster_voice' && !subtitleSettings.monster_voice) return;
      const el = q<HTMLElement>(".hz-message");
      el.textContent = text;
      el.style.opacity = "1";
      el.className = `hz-message hz-subtitle--${category.replace(/_/g, '-')}`;
      messageTimer = 120;
    }

    // Picks a random line from a quip key and shows it immediately.
    function fireQuip(key: QuipKey) {
      const line = pickRandom(QUIPS[key]);
      showMessage(line.text, 'player', line.audio);
    }

    // Marks that combat is active, delaying lull-based quips.
    function signalCombat() { quipLullTimer = 90; }

    // Adds a combat quip to the lull queue (max 3; drops if full).
    function queueQuip(key: QuipKey, weaponKey?: QuipKey) {
      if (quipQueue.length < 3) quipQueue.push({ key, weaponKey });
    }

    // Shows a quip immediately if the global cooldown allows; skips if busy.
    function softFireQuip(key: QuipKey) {
      if (quipCooldown > 0) return;
      fireQuip(key);
      quipCooldown = 200;
    }

    // ── Help overlay ───────────────────────────────────────────────────────────
    function updateHelpOverlay() {
      const el = root.querySelector<HTMLElement>(".hz-help-overlay");
      if (el) el.style.display = showHelp ? "flex" : "none";
    }

    // ── Input ──────────────────────────────────────────────────────────────────
    function handleKeyDown(e: KeyboardEvent) {
      keys[e.code] = true;
      if (e.code === "KeyM") showFullMap = !showFullMap;
      if (e.code === "CapsLock") capsLocked = !capsLocked;
      if (e.code === "F1" || e.key === "?") { showHelp = !showHelp; updateHelpOverlay(); }
      if (e.code === "Enter") handleEnter();
      if (e.code === "Space" && gameState === "playing") tryFire();
      if (e.code === "KeyE" && gameState === "playing") tryUseDoor();
      // Weapon switching 1-5
      if (gameState === "playing") {
        const wMap: Record<string, WeaponId> = { Digit1:'claws', Digit2:'subwoofer', Digit3:'woofer', Digit4:'tennis', Digit5:'flamethrower' };
        if (wMap[e.code]) switchWeapon(wMap[e.code]);
      }
      if (showExitConfirm) {
        if (e.key.toUpperCase() === 'Y') { hideExitModal(); return; }
        if (e.key.toUpperCase() === 'N') { quitToTos(); return; }
        if (e.code === 'Escape') { hideExitModal(); return; }
        return;
      }
      if (e.code === "Escape") {
        if (gameState === "playing") {
          setScreen("title");
          if (document.pointerLockElement) document.exitPointerLock();
        } else if (showCheatsMenu) {
          showCheatsMenu = false; updateCheatsMenu();
        } else {
          showExitModal();
        }
        return;
      }
      // Cheat code buffer — accumulate typed letters
      if (e.key.length === 1 && /[A-Za-z]/.test(e.key)) {
        cheatBuffer = (cheatBuffer + e.key.toUpperCase()).slice(-8);
        clearTimeout(cheatClearTimer);
        cheatClearTimer = window.setTimeout(() => { cheatBuffer = ''; }, 2500);
        if (cheatBuffer.endsWith('EGOBOOM')) { activateCheat('boom'); cheatBuffer = ''; }
        else if (cheatBuffer.endsWith('EGOKEY')) { activateCheat('key'); cheatBuffer = ''; }
        else if (cheatBuffer.endsWith('EGOD')) { activateCheat('god'); cheatBuffer = ''; }
      }
      initAudio();
      e.preventDefault();
    }
    function handleKeyUp(e: KeyboardEvent) { keys[e.code] = false; }

    function handleMouseDown(e: MouseEvent) {
      initAudio();
      mouseHeld = true;
      if (gameState === "playing") {
        if (!pointerLocked) canvas.requestPointerLock();
        else tryFire();
      }
      if (gameState === "title") handleEnter();
      if (e.button === 0 && pointerLocked && gameState === "playing") tryFire();
    }
    function handleMouseUp() { mouseHeld = false; }

    function handleMouseMove(e: MouseEvent) {
      if (pointerLocked && gameState === "playing") player.angle += e.movementX * MOUSE_SENSITIVITY;
    }

    function handlePointerLockChange() {
      pointerLocked = document.pointerLockElement === canvas;
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    // ── Touch overlay ──────────────────────────────────────────────────────────
    const FAB_KEY_MAP: Record<string, string> = {
      ".hz-fab-fwd":  "ArrowUp",
      ".hz-fab-back": "ArrowDown",
      ".hz-fab-sl":   "KeyA",
      ".hz-fab-sr":   "KeyD",
      ".hz-fab-tl":   "ArrowLeft",
      ".hz-fab-tr":   "ArrowRight",
    };

    const fabCleanups: (() => void)[] = [];

    function bindFAB(sel: string, keyCode: string) {
      const el = root.querySelector<HTMLElement>(sel);
      if (!el) return;
      const on  = (ev: Event) => { ev.preventDefault(); keys[keyCode] = true;  el.classList.add("pressed"); };
      const off = (ev: Event) => { ev.preventDefault(); keys[keyCode] = false; el.classList.remove("pressed"); };
      el.addEventListener("touchstart",  on,  { passive: false });
      el.addEventListener("touchend",    off, { passive: false });
      el.addEventListener("touchcancel", off, { passive: false });
      el.addEventListener("mousedown", on);
      el.addEventListener("mouseup",   off);
      el.addEventListener("mouseleave", off);
      fabCleanups.push(() => {
        el.removeEventListener("touchstart",  on);
        el.removeEventListener("touchend",    off);
        el.removeEventListener("touchcancel", off);
        el.removeEventListener("mousedown", on);
        el.removeEventListener("mouseup",   off);
        el.removeEventListener("mouseleave", off);
      });
    }

    for (const [sel, key] of Object.entries(FAB_KEY_MAP)) bindFAB(sel, key);

    const fabShoot = root.querySelector<HTMLElement>(".hz-fab-shoot");
    if (fabShoot) {
      const fireOn  = (ev: Event) => { ev.preventDefault(); fabShoot.classList.add("pressed"); touchFireHeld = true; if (gameState === "playing") tryFire(); };
      const fireOff = (ev: Event) => { ev.preventDefault(); fabShoot.classList.remove("pressed"); touchFireHeld = false; };
      fabShoot.addEventListener("touchstart",  fireOn,  { passive: false });
      fabShoot.addEventListener("touchend",    fireOff, { passive: false });
      fabShoot.addEventListener("touchcancel", fireOff, { passive: false });
      fabShoot.addEventListener("mousedown", fireOn);
      fabShoot.addEventListener("mouseup",   fireOff);
      fabCleanups.push(() => {
        fabShoot.removeEventListener("touchstart", fireOn);
        fabShoot.removeEventListener("touchend", fireOff);
        fabShoot.removeEventListener("touchcancel", fireOff);
        fabShoot.removeEventListener("mousedown", fireOn);
        fabShoot.removeEventListener("mouseup", fireOff);
      });
    }

    // Weapon slot click/tap handlers
    for (const slot of WEAPON_SLOT_DATA) {
      const slotEl = root.querySelector<HTMLElement>(`#hz-wslot-${slot.id}`);
      if (!slotEl) continue;
      const handler = (ev: Event) => { ev.preventDefault(); initAudio(); if (gameState === 'playing') switchWeapon(slot.id); };
      slotEl.addEventListener('click', handler);
      slotEl.addEventListener('touchstart', handler, { passive: false });
      fabCleanups.push(() => {
        slotEl.removeEventListener('click', handler);
        slotEl.removeEventListener('touchstart', handler);
      });
    }

    const fabMap = root.querySelector<HTMLElement>(".hz-fab-map");
    if (fabMap) {
      const toggle = (ev: Event) => { ev.preventDefault(); showFullMap = !showFullMap; fabMap.classList.toggle("pressed", showFullMap); };
      fabMap.addEventListener("touchstart", toggle, { passive: false });
      fabMap.addEventListener("click", toggle);
      fabCleanups.push(() => { fabMap.removeEventListener("touchstart", toggle); fabMap.removeEventListener("click", toggle); });
    }

    const fabEsc = root.querySelector<HTMLElement>(".hz-fab-esc");
    if (fabEsc) {
      const doEsc = (ev: Event) => {
        ev.preventDefault();
        if (showExitConfirm) { hideExitModal(); return; }
        if (gameState === "playing") {
          setScreen("title");
          if (document.pointerLockElement) document.exitPointerLock();
        } else {
          showExitModal();
        }
      };
      fabEsc.addEventListener("touchstart", doEsc, { passive: false });
      fabEsc.addEventListener("click", doEsc);
      fabCleanups.push(() => { fabEsc.removeEventListener("touchstart", doEsc); fabEsc.removeEventListener("click", doEsc); });
    }

    const fabUse = root.querySelector<HTMLElement>(".hz-fab-use");
    if (fabUse) {
      const doUse = (ev: Event) => { ev.preventDefault(); if (gameState === "playing") tryUseDoor(); };
      fabUse.addEventListener("touchstart", doUse, { passive: false });
      fabUse.addEventListener("click", doUse);
      fabCleanups.push(() => { fabUse.removeEventListener("touchstart", doUse); fabUse.removeEventListener("click", doUse); });
    }

    // Minimap click/tap toggles full map
    const minimapEl = minimapRef.current;
    if (minimapEl) {
      const toggleFullMap = (ev: Event) => { ev.preventDefault(); showFullMap = !showFullMap; };
      minimapEl.addEventListener("click", toggleFullMap);
      minimapEl.addEventListener("touchstart", toggleFullMap, { passive: false });
      fabCleanups.push(() => {
        minimapEl.removeEventListener("click", toggleFullMap);
        minimapEl.removeEventListener("touchstart", toggleFullMap);
      });
    }

    // Help button click
    const helpBtn = root.querySelector<HTMLButtonElement>(".hz-help-btn");
    if (helpBtn) {
      let longPressTimer = 0;
      const helpPointerDown = () => {
        longPressTriggered = false;
        longPressTimer = window.setTimeout(() => {
          longPressTriggered = true;
          showCheatsMenu = true;
          updateCheatsMenu();
        }, 800);
      };
      const helpPointerUp = () => { clearTimeout(longPressTimer); };
      const helpClick = () => {
        if (longPressTriggered) { longPressTriggered = false; return; }
        showHelp = !showHelp; updateHelpOverlay();
      };
      helpBtn.addEventListener("pointerdown", helpPointerDown);
      helpBtn.addEventListener("pointerup", helpPointerUp);
      helpBtn.addEventListener("pointercancel", helpPointerUp);
      helpBtn.addEventListener("click", helpClick);
      fabCleanups.push(() => {
        helpBtn.removeEventListener("pointerdown", helpPointerDown);
        helpBtn.removeEventListener("pointerup", helpPointerUp);
        helpBtn.removeEventListener("pointercancel", helpPointerUp);
        helpBtn.removeEventListener("click", helpClick);
      });
    }

    // Cheats menu buttons
    const cheatGodBtn   = root.querySelector<HTMLElement>('#hz-cheat-god');
    const cheatBoomBtn  = root.querySelector<HTMLElement>('#hz-cheat-boom');
    const cheatKeyBtn   = root.querySelector<HTMLElement>('#hz-cheat-key');
    const cheatCloseBtn = root.querySelector<HTMLElement>('#hz-cheat-close');
    if (cheatGodBtn) {
      const fn = () => activateCheat('god');
      cheatGodBtn.addEventListener('click', fn);
      fabCleanups.push(() => cheatGodBtn.removeEventListener('click', fn));
    }
    if (cheatBoomBtn) {
      const fn = () => activateCheat('boom');
      cheatBoomBtn.addEventListener('click', fn);
      fabCleanups.push(() => cheatBoomBtn.removeEventListener('click', fn));
    }
    if (cheatKeyBtn) {
      const fn = () => activateCheat('key');
      cheatKeyBtn.addEventListener('click', fn);
      fabCleanups.push(() => cheatKeyBtn.removeEventListener('click', fn));
    }
    if (cheatCloseBtn) {
      const fn = () => { showCheatsMenu = false; updateCheatsMenu(); };
      cheatCloseBtn.addEventListener('click', fn);
      fabCleanups.push(() => cheatCloseBtn.removeEventListener('click', fn));
    }

    // Exit confirmation modal buttons
    const exitStayBtn = root.querySelector<HTMLElement>('.hz-exit-stay');
    const exitQuitBtn = root.querySelector<HTMLElement>('.hz-exit-quit');
    if (exitStayBtn) {
      const fn = (ev: Event) => { ev.preventDefault(); hideExitModal(); };
      exitStayBtn.addEventListener('click', fn);
      exitStayBtn.addEventListener('touchstart', fn, { passive: false });
      fabCleanups.push(() => { exitStayBtn.removeEventListener('click', fn); exitStayBtn.removeEventListener('touchstart', fn); });
    }
    if (exitQuitBtn) {
      const fn = (ev: Event) => { ev.preventDefault(); quitToTos(); };
      exitQuitBtn.addEventListener('click', fn);
      exitQuitBtn.addEventListener('touchstart', fn, { passive: false });
      fabCleanups.push(() => { exitQuitBtn.removeEventListener('click', fn); exitQuitBtn.removeEventListener('touchstart', fn); });
    }

    function showTouchOverlay() {
      const overlay = root.querySelector<HTMLElement>(".hz-touch-overlay");
      const fsBtn = root.querySelector<HTMLElement>(".hz-btn-fullscreen");
      if (overlay) overlay.style.display = "block";
      if (fsBtn) fsBtn.style.display = "flex";
    }
    window.addEventListener("touchstart", showTouchOverlay, { once: true });

    // Tap-to-continue on menu screens
    const titleEl  = root.querySelector<HTMLElement>(".hz-title-screen")!;
    const deathEl  = root.querySelector<HTMLElement>(".hz-death-screen")!;
    const clearEl  = root.querySelector<HTMLElement>(".hz-level-clear")!;

    const tapEnter = (ev: Event) => { ev.preventDefault(); handleEnter(); };
    titleEl.addEventListener("touchstart", tapEnter, { passive: false });
    deathEl.addEventListener("touchstart", tapEnter, { passive: false });
    clearEl.addEventListener("touchstart", tapEnter, { passive: false });

    // ── Fullscreen ─────────────────────────────────────────────────────────────
    const fsBtn = root.querySelector<HTMLButtonElement>(".hz-btn-fullscreen");
    if (fsBtn) {
      const fsClick = () => {
        const el = document.documentElement;
        if (!document.fullscreenElement) {
          (el.requestFullscreen || (el as HTMLElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen || (el as HTMLElement & { mozRequestFullScreen?: () => void }).mozRequestFullScreen)?.call(el);
        } else {
          (document.exitFullscreen || (document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen || (document as Document & { mozCancelFullScreen?: () => void }).mozCancelFullScreen)?.call(document);
        }
      };
      fsBtn.addEventListener("click", fsClick);
      const fsChange = () => { fsBtn.textContent = document.fullscreenElement ? "✕" : "⛶"; };
      document.addEventListener("fullscreenchange", fsChange);
      document.addEventListener("webkitfullscreenchange", fsChange);
      fabCleanups.push(() => {
        fsBtn.removeEventListener("click", fsClick);
        document.removeEventListener("fullscreenchange", fsChange);
        document.removeEventListener("webkitfullscreenchange", fsChange);
      });
    }

    // ── Main loop ──────────────────────────────────────────────────────────────
    let rafId = 0;
    let lastTime = 0;

    function loop(ts: number) {
      const dt = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      if (gameState === "playing") {
        movePlayer(dt);
        updateDoors(dt);
        updateEnemies(dt);
        updateProjectiles(dt);
        updateFlameParticles(dt);
        if (shootCooldown > 0) shootCooldown -= dt * 60;
        if (gunRecoil > 0) gunRecoil = Math.max(0, gunRecoil - 0.15 * dt * 60);
        if (muzzleFlashTimer > 0) muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt * 60);
        if (hurtCooldown > 0) hurtCooldown -= dt * 60;
        // Quip lull system: fire a queued combat quip after ~1.5 s of quiet
        if (quipCooldown > 0) quipCooldown -= dt * 60;
        if (quipLullTimer > 0) quipLullTimer -= dt * 60;
        if (quipLullTimer <= 0 && quipCooldown <= 0 && quipQueue.length > 0) {
          const { key, weaponKey } = quipQueue.shift()!;
          const pool = weaponKey ? [...QUIPS[weaponKey], ...QUIPS[key]] : QUIPS[key];
          const line = pool[Math.floor(Math.random() * pool.length)];
          showMessage(line.text, 'player', line.audio);
          quipCooldown = 300;
          quipQueue.length = 0;
        }
        // Low health — queue once per level when first crossing below 25
        if (!playerLowHealthQuipped && player.health > 0 && player.health < 25) {
          playerLowHealthQuipped = true;
          queueQuip('player_low_health');
        }
        // Low ammo — queue once each time ammo drops through the threshold
        if (prevBullets > 10 && player.ammo <= 10 && player.ammo > 0) queueQuip('player_low_ammo_bullets');
        prevBullets = player.ammo;
        if (prevBalls > 5 && ballAmmo <= 5 && ballAmmo > 0) queueQuip('player_low_ammo_balls');
        prevBalls = ballAmmo;
        if (prevFuel > 10 && fuelAmmo <= 10 && fuelAmmo > 0) queueQuip('player_low_ammo_fuel');
        prevFuel = fuelAmmo;
        if (messageTimer > 0) {
          messageTimer -= dt * 60;
          if (messageTimer <= 0) {
            const msgEl = root.querySelector<HTMLElement>(".hz-message");
            if (msgEl) msgEl.style.opacity = "0";
          }
        }
        // Weapon switch animation (~9 frames = 0.15s each phase)
        if (switchState === 'lowering') {
          switchProgress = Math.min(1, switchProgress + dt * 60 / 9);
          if (switchProgress >= 1) { currentWeapon = switchingTo; switchState = 'raising'; }
        } else if (switchState === 'raising') {
          switchProgress = Math.max(0, switchProgress - dt * 60 / 9);
          if (switchProgress <= 0) { switchState = 'idle'; }
        }
        // Auto-fire for held weapons
        if (switchState === 'idle' && shootCooldown <= 0) {
          const held = keys['Space'] || mouseHeld || touchFireHeld;
          if (held && (currentWeapon === 'woofer' || currentWeapon === 'flamethrower')) tryFire();
        }
        render();
        renderMap();
      }
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(ts => { lastTime = ts; rafId = requestAnimationFrame(loop); });

    setScreen("title");

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      window.removeEventListener("touchstart", showTouchOverlay);
      titleEl.removeEventListener("touchstart", tapEnter);
      deathEl.removeEventListener("touchstart", tapEnter);
      clearEl.removeEventListener("touchstart", tapEnter);
      fabCleanups.forEach(fn => fn());
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, []);

  return (
    <div className="hellzone-root" ref={rootRef}>
      <div className="hellzone-wrapper">

        {/* Exit confirmation — full terminal screen, no dialog box */}
        <div className="hz-exit-modal" style={{ display: 'none' }}>
          <div className="hz-exit-screen">
            <div className="hz-exit-rule">══════════════════════════════</div>
            <div className="hz-exit-heading">R E A L L Y &nbsp; Q U I T ?</div>
            <div className="hz-exit-rule">══════════════════════════════</div>
            <div className="hz-exit-prompt"></div>
            <div className="hz-exit-choices">
              <button className="hz-exit-stay"></button>
              <button className="hz-exit-quit"></button>
            </div>
          </div>
        </div>

        {/* Title screen */}
        <div className="hz-title-screen">
          <div className="hz-title-logo">HELL</div>
          <div className="hz-title-sub">P R O</div>
          <div className="hz-title-version">VERSION 0.3 SHAREWARE — 1 OF 3 EPISODES</div>
          <div className="hz-title-art">
            ▓▓▓▓▒▒░░  KILL THEM ALL  ░░▒▒▓▓▓▓<br />
            ╔══════════════════════════════╗<br />
            ║  FEATURING  PROCEDURAL  MAPS ║<br />
            ║   INTELLIGENT ENEMY  AI(tm)  ║<br />
            ║    ULTRA-GORE  TECHNOLOGY    ║<br />
            ╚══════════════════════════════╝
          </div>
          <div className="hz-title-press">[ PRESS ENTER TO BEGIN ]</div>
          <div className="hz-title-quit">[ ESC ] QUIT TO NS-TOS</div>
          <div className="hz-title-register">
            HELL IS SHAREWARE — COPY AND DISTRIBUTE FREELY<br />
            <span>REGISTER THE FULL GAME FOR $29.99 — CALL 1-800-HELL-EGO</span><br />
            © 1994 EGO SOFTWARE INC. — ALL RIGHTS RESERVED
          </div>
        </div>

        {/* Game */}
        <div className="hz-game-container">
          {/* Top bar: minimap above the canvas, in the black space */}
          <div className="hz-top-bar">
            <canvas ref={minimapRef} className="hz-minimap" width={80} height={80} />
          </div>
          <div style={{ position: "relative" }}>
            <canvas ref={canvasRef} className="hz-render-canvas" width={320} height={180} />
            <div className="hz-crosshair" />
            <div className="hz-message" />
            {/* Help overlay (DOM layer over canvas) */}
            <div className="hz-help-overlay">
              <div className="hz-help-panel">
                <div className="hz-help-title">CONTROLS</div>
                <ul className="hz-help-list">
                  <li><span>WASD / ARROWS</span><span>Move &amp; Strafe</span></li>
                  <li><span>MOUSE / ↺↻</span><span>Turn</span></li>
                  <li><span>SPACE / LMB / FIRE</span><span>Shoot</span></li>
                  <li><span>E</span><span>Open / close door</span></li>
                  <li><span>1-5 / WEAPON SLOTS</span><span>Switch weapon</span></li>
                  <li><span>M</span><span>Toggle full map</span></li>
                  <li><span>SHIFT</span><span>Sprint</span></li>
                  <li><span>CAPS LOCK</span><span>Toggle always-sprint</span></li>
                  <li><span>F1 / ?</span><span>Toggle this help</span></li>
                  <li><span>ESC</span><span>Menu</span></li>
                </ul>
              </div>
            </div>
            <div className="hz-level-clear">
              <div className="hz-clear-title">LEVEL CLEAR!</div>
              <div className="hz-clear-sub">[ ENTER ] NEXT LEVEL</div>
              <div className="hz-clear-quit">[ ESC ] QUIT TO NS-TOS</div>
            </div>
            {/* Cheats overlay */}
            <div className="hz-cheats-overlay" style={{ display: 'none' }}>
              <div className="hz-cheats-panel">
                <div className="hz-cheats-title">EGO CHEATS</div>
                <button className="hz-cheat-btn" id="hz-cheat-god">EGOD — GOD MODE</button>
                <button className="hz-cheat-btn" id="hz-cheat-boom">EGOBOOM — ALL WEAPONS</button>
                <button className="hz-cheat-btn" id="hz-cheat-key">EGOKEY — ALL KEYS</button>
                <button className="hz-cheat-close" id="hz-cheat-close">CLOSE [ESC]</button>
              </div>
            </div>
          </div>
          {/* Compact HUD: health + face + weapons only */}
          <div className="hz-hud">
            <div className="hz-hud-value" id="hz-hud-health">100</div>
            <canvas ref={faceRef} className="hz-face-sprite" width={24} height={24} />
            <div className="hz-weapon-bar">
              {WEAPON_SLOT_DATA.map((slot, i) => (
                <div key={slot.id} className="hz-weapon-slot unowned" id={`hz-wslot-${slot.id}`}>
                  <div className="hz-wslot-num">[{i + 1}]</div>
                  <div className="hz-wslot-name">{slot.abbrev}</div>
                  <div className="hz-wslot-ammo" id={`hz-wslot-ammo-${slot.id}`}>×</div>
                </div>
              ))}
            </div>
          </div>
          {/* Death screen overlays the entire game container */}
          <div className="hz-death-screen">
            <div className="hz-death-title">YOU DIED</div>
            <div className="hz-death-sub">GAME OVER, MAN</div>
            <div className="hz-death-stats" id="hz-death-stats"></div>
            <div className="hz-death-press">[ ENTER ] TRY AGAIN</div>
            <div className="hz-death-quit">[ ESC ] QUIT TO NS-TOS</div>
          </div>
        </div>
      </div>

      {/* Fullscreen button */}
      <button className="hz-btn-fullscreen" title="Fullscreen">⛶</button>
      {/* Help button */}
      <button className="hz-help-btn" title="Controls (F1 / ?)">?</button>

      {/* Touch overlay */}
      <div className="hz-touch-overlay">
        <div className="hz-fab hz-fab-fwd">▲</div>
        <div className="hz-fab hz-fab-back">▼</div>
        <div className="hz-fab hz-fab-sl">◄</div>
        <div className="hz-fab hz-fab-sr">►</div>
        <div className="hz-fab hz-fab-tl">↺</div>
        <div className="hz-fab hz-fab-tr">↻</div>
        <div className="hz-fab hz-fab-esc">ESC</div>
        <div className="hz-fab hz-fab-map">MAP</div>
        <div className="hz-fab hz-fab-use">USE</div>
        <div className="hz-fab hz-fab-shoot">FIRE</div>
      </div>
    </div>
  );
}
