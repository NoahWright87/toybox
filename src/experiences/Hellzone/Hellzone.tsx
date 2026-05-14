import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sprite } from "./sprites";
import "./Hellzone.css";

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
    const TILE_EMPTY = 0, TILE_WALL = 1, TILE_EXIT = 3;

    interface Room { x: number; y: number; w: number; h: number; cx: number; cy: number; }
    interface Enemy {
      x: number; y: number; angle: number; health: number; maxHealth: number;
      state: string; type: number; shootTimer: number; alertRange: number;
      speed: number; deathTimer: number; muzzleFlash: number;
    }
    interface Pickup { x: number; y: number; type: string; taken: boolean; }

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
          });
        }
      }

      const pickups: Pickup[] = [];
      for (let i = 2; i < rooms.length - 1; i += 2) {
        const room = rooms[i];
        pickups.push({ x: (room.cx + 0.5) * CELL, y: (room.cy + 0.5) * CELL, type: rng() > 0.5 ? "health" : "ammo", taken: false });
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

      // Hallway A→B
      for (let y = 13; y <= 19; y++)
        for (let x = 10; x <= 12; x++)
          grid[y][x] = TILE_EMPTY;

      // Room B: patrol range
      for (let y = 20; y <= 34; y++)
        for (let x = 3; x <= 24; x++)
          grid[y][x] = TILE_EMPTY;

      // Exit
      for (let x = 11; x <= 13; x++)
        grid[35][x] = TILE_EXIT;

      const enemies: Enemy[] = [];

      const mkDummy = (x: number, y: number): Enemy => ({
        x, y, angle: 0, health: 50, maxHealth: 50,
        state: "idle", type: 3, shootTimer: 999999, alertRange: 0, speed: 0, deathTimer: 0, muzzleFlash: 0,
      });

      let pi = 0;
      const mkPatrol = (x: number, y: number): Enemy => ({
        x, y, angle: (pi++ * 1.618) % (Math.PI * 2),
        health: 40, maxHealth: 40,
        state: "idle", type: pi % 3, shootTimer: 999999, alertRange: 0, speed: 0, deathTimer: 0, muzzleFlash: 0,
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
        [5.5, 27.5], [11.5, 29.5], [17.5, 26.5], [21.5, 30.5],
        [8.5, 33.5], [15.5, 32.5],
      ].forEach(([col, row]) => enemies.push(mkPatrol(col * CELL, row * CELL)));

      const pickups: Pickup[] = [
        { x: 6.5 * CELL,  y: 3.5 * CELL,  type: "ammo",   taken: false },
        { x: 19.5 * CELL, y: 3.5 * CELL,  type: "health", taken: false },
        { x: 13.5 * CELL, y: 27.5 * CELL, type: "ammo",   taken: false },
        { x: 13.5 * CELL, y: 31.5 * CELL, type: "health", taken: false },
      ];

      const rooms: Room[] = [
        { x: 3, y: 2,  w: 20, h: 11, cx: 12, cy: 7  },
        { x: 3, y: 20, w: 22, h: 15, cx: 13, cy: 27 },
      ];

      return { grid, rooms, enemies, pickups, spawn: { x: 12.5 * CELL, y: 4.5 * CELL, angle: Math.PI / 2 }, seed: 0 };
    }

    // ── Colors ─────────────────────────────────────────────────────────────────
    const WALL_COLORS = [
      null,
      { light: "#8B4513", dark: "#5C2D0A" },
      { light: "#888", dark: "#444" },
      { light: "#FFD700", dark: "#AA8800" },
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

    // ── Sprites ─────────────────────────────────────────────────────────────────
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
    const sprGun = new Sprite('/sprites/gun-pistol.png');
    const sprImpactWall = new Sprite('/sprites/impact-wall.png');
    const sprImpactEnemy = new Sprite('/sprites/impact-enemy.png');

    // ── Sound system ───────────────────────────────────────────────────────────
    let audioCtx: AudioContext | null = null;
    const soundBuffers = new Map<string, AudioBuffer>();

    function initAudio() {
      if (audioCtx) return;
      try {
        audioCtx = new AudioContext();
        const names = ['intro','shoot','hit-wall','hit-enemy','hurt','death','level-complete','pickup','alert'];
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
      if (s === "clear") playSound('level-complete');
    }

    function quitToTos() {
      if (document.pointerLockElement) document.exitPointerLock();
      navigateRef.current("/ns-tos");
    }

    // ── Level init ─────────────────────────────────────────────────────────────
    function startGame() {
      kills = 0; totalKills = 0; level = 1;
      seed = Math.floor(Math.random() * 99999);
      player = null as unknown as Player;
      initLevel();
      setScreen("playing");
      setTimeout(() => playSound('intro'), 200);
    }

    function nextLevel() {
      level++;
      seed = Math.floor(Math.random() * 99999);
      initLevel();
      setScreen("playing");
    }

    function initLevel() {
      const data = level === 1 ? generateTrainingMap() : generateMap(seed);
      map = data.grid;
      enemies = data.enemies;
      pickups = data.pickups;
      totalKills = enemies.length;
      player = {
        x: data.spawn.x, y: data.spawn.y, angle: data.spawn.angle,
        health: player ? Math.min(Math.max(player.health, 1), 100) : 100,
        ammo:   player ? Math.max(player.ammo, 10) : 50,
        velX: 0, velY: 0, angVel: 0,
      };
      q("#hz-hud-level").textContent = String(level);
      q("#hz-hud-seed").textContent = level === 1 ? "TRAINING" : "SEED:" + seed;
      if (level === 1) {
        setTimeout(() => showMessage("ROOM A: SHOOT THE TARGETS"), 600);
        setTimeout(() => showMessage("ROOM B: SOUTH HALLWAY — MOVING TARGETS"), 4000);
      }
    }

    function handleEnter() {
      if (gameState === "title") startGame();
      else if (gameState === "dead") startGame();
      else if (gameState === "clear") nextLevel();
    }

    // ── Raycasting ─────────────────────────────────────────────────────────────
    function castRay(angle: number) {
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
      for (let i = 0; i < MAX_DEPTH * 2; i++) {
        if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
        else                        { sideDistY += deltaDistY; mapY += stepY; side = 1; }
        if (mapX < 0 || mapX >= MAP_W || mapY < 0 || mapY >= MAP_H) { dist = MAX_DEPTH; break; }
        tile = map[mapY][mapX];
        if (tile === TILE_WALL || tile === TILE_EXIT) { hit = true; break; }
      }
      if (hit) {
        dist = side === 0
          ? (mapX - player.x / CELL + (1 - stepX) / 2) / rayDirX
          : (mapY - player.y / CELL + (1 - stepY) / 2) / rayDirY;
      } else {
        dist = MAX_DEPTH;
      }
      return { dist: Math.max(dist, 0.1), side, tile, hit };
    }

    // ── Rendering ──────────────────────────────────────────────────────────────
    function render() {
      ctx.fillStyle = CEILING_COLOR;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H / 2);
      ctx.fillStyle = FLOOR_COLOR;
      ctx.fillRect(0, SCREEN_H / 2, SCREEN_W, SCREEN_H / 2);

      for (let x = 0; x < NUM_RAYS; x++) {
        const rayAngle = player.angle - HALF_FOV + (x / NUM_RAYS) * FOV;
        const { dist, side, tile, hit } = castRay(rayAngle);
        const perpDist = dist * Math.cos(rayAngle - player.angle);
        zBuffer[x] = hit ? perpDist : MAX_DEPTH;
        if (!hit) continue;
        const wallH = Math.min(SCREEN_H, (SCREEN_H / perpDist) * 0.8);
        const top = (SCREEN_H - wallH) / 2;
        const colors = WALL_COLORS[tile] || WALL_COLORS[1];
        const color = side === 1 ? colors!.dark : colors!.light;
        const fog = Math.max(0, 1 - perpDist / MAX_DEPTH);
        ctx.globalAlpha = fog * fog + 0.05;
        ctx.fillStyle = color;
        ctx.fillRect(x, top, 1, wallH);
        ctx.globalAlpha = 1;
      }

      renderSprites();
      drawImpacts();
      drawGun();

      if (flashTimer > 0) {
        ctx.fillStyle = `rgba(200,0,0,${(flashTimer / 20) * 0.5})`;
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
        flashTimer--;
      }

      // Sprint indicator
      ctx.fillStyle = "#c00";
      ctx.font = "6px 'Share Tech Mono', monospace";
      ctx.fillText(sprinting ? "FST" : "SLO", 4, SCREEN_H - 4);

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
      const sprites: { type: string; obj: Enemy | Pickup; dist: number }[] = [];
      for (const e of enemies) {
        const dx = e.x - player.x, dy = e.y - player.y;
        sprites.push({ type: "enemy", obj: e, dist: Math.sqrt(dx * dx + dy * dy) });
      }
      for (const p of pickups) {
        if (p.taken) continue;
        const dx = p.x - player.x, dy = p.y - player.y;
        sprites.push({ type: "pickup", obj: p, dist: Math.sqrt(dx * dx + dy * dy) });
      }
      sprites.sort((a, b) => b.dist - a.dist);
      for (const s of sprites) {
        if (s.type === "enemy") drawEnemySprite(s.obj as Enemy);
        else drawPickupSprite(s.obj as Pickup);
      }
    }

    function drawEnemySprite(e: Enemy) {
      if (e.type === 3) { drawTargetSprite(e); return; }
      const proj = projectSprite(e.x, e.y);
      if (!proj) return;
      const { screenX, spriteH, spriteW, tz } = proj;
      const startX = Math.floor(screenX - spriteW / 2);
      const startY = Math.floor((SCREEN_H - spriteH) / 2);

      // Center-column z-check
      if (tz >= zBuffer[Math.max(0, Math.min(SCREEN_W-1, screenX))]) return;

      const spr = e.state === 'dead' ? sprEnemyDead : (sprEnemy[e.type] ?? sprEnemy[0]);
      if (spr.loaded) {
        const fog = Math.max(0, 1 - tz / MAX_DEPTH);
        ctx.globalAlpha = fog * 0.85 + 0.15;
        spr.draw(ctx, 0, startX, startY, spriteW, spriteH);
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

      // Center-column z-check
      if (tz >= zBuffer[Math.max(0, Math.min(SCREEN_W-1, screenX))]) return;

      const spr = isDead ? sprTargetDead : sprTarget;
      if (spr.loaded) {
        const fog = Math.max(0, 1 - tz / MAX_DEPTH);
        ctx.globalAlpha = fog * 0.85 + 0.15;
        spr.draw(ctx, 0, startX, startY, spriteW, spriteH);
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

      // Center-column z-check
      if (tz >= zBuffer[Math.max(0, Math.min(SCREEN_W-1, screenX))]) return;

      const spr = p.type === "health" ? sprPickupHealth : sprPickupAmmo;
      if (spr.loaded) {
        const fog = Math.max(0, 1 - tz / MAX_DEPTH);
        ctx.globalAlpha = fog * 0.85 + 0.15;
        spr.draw(ctx, 0, startX, startY, size, size);
        ctx.globalAlpha = 1;
      } else {
        // Fallback: procedural
        const col = p.type === "health" ? "#00cc44" : "#ffaa00";
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

    // ── Gun / Weapon ───────────────────────────────────────────────────────────
    function drawGun() {
      const recoil = Math.round(gunRecoil * 10);
      const gw = 24, gh = 48;
      const dx = Math.floor(SCREEN_W / 2) - gw / 2;
      const dy = SCREEN_H - gh + 18 + recoil;

      if (sprGun.loaded) {
        sprGun.draw(ctx, 0, dx, dy, gw, gh);
      } else {
        // Fallback: procedural vertical gun
        const cx = Math.floor(SCREEN_W / 2);
        const cy = SCREEN_H + 4 + recoil;
        // Barrel (vertical, pointing up)
        ctx.fillStyle = "#777";
        ctx.fillRect(cx - 3, cy - 40, 6, 30);
        // Barrel tip/muzzle
        ctx.fillStyle = "#555";
        ctx.fillRect(cx - 4, cy - 42, 8, 4);
        // Slide/body
        ctx.fillStyle = "#666";
        ctx.fillRect(cx - 12, cy - 16, 24, 16);
        // Inner body
        ctx.fillStyle = "#444";
        ctx.fillRect(cx - 9, cy - 13, 18, 13);
        // Grip
        ctx.fillStyle = "#3a2a18";
        ctx.fillRect(cx - 9, cy - 2, 18, 20);
        // Grip texture
        for (let i = 0; i < 3; i++) ctx.fillRect(cx - 7 + i * 5, cy, 2, 14);
      }

      if (muzzleFlashTimer > 0) drawMuzzleFlash(Math.floor(SCREEN_W / 2), dy + 2, muzzleFlashTimer);
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
          else if (tile === TILE_EXIT) mapCtx.fillStyle = "#ffdd00";
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
          else if (tile === TILE_EXIT) { ctx.fillStyle = "#ffdd00"; }
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
      ctx.fillText("[ M ] CLOSE MAP", offsetX, offsetY - 3);
    }

    // ── HUD ────────────────────────────────────────────────────────────────────
    function updateHUD() {
      const hHealth = q<HTMLElement>("#hz-hud-health");
      const hAmmo   = q<HTMLElement>("#hz-hud-ammo");
      const hKills  = q<HTMLElement>("#hz-hud-kills");
      hHealth.textContent = String(Math.max(0, Math.ceil(player.health)));
      hAmmo.textContent   = String(player.ammo);
      hKills.textContent  = String(kills);
      hHealth.className = "hz-hud-value" + (player.health <= 20 ? " low" : "");
      hAmmo.className   = "hz-hud-value" + (player.ammo <= 5 ? " low" : "");
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
        if (map[ty][tx] === TILE_WALL) return false;
      }
      return true;
    }

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
          playSound('pickup');
          if (p.type === "health") { player.health = Math.min(100, player.health + 25); showMessage("+ HEALTH PACK"); }
          else { player.ammo = Math.min(99, player.ammo + 20); showMessage("+ AMMO CRATE"); }
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
        if (map[ty][tx] === TILE_WALL) return false;
      }
      return true;
    }

    function shoot() {
      if (shootCooldown > 0 || player.ammo <= 0) {
        if (player.ammo <= 0) showMessage("OUT OF AMMO!");
        return;
      }
      player.ammo--;
      shootCooldown = 12;
      gunRecoil = 1.0;
      muzzleFlashTimer = 8;
      playSound('shoot');
      let nearest: Enemy | null = null, nearDist = Infinity;
      for (const e of enemies) {
        if (e.state === "dead") continue;
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
      if (nearest) {
        const damage = 15 + Math.floor(Math.random() * 10);
        nearest.health -= damage;
        nearest.state = "chase";
        const proj = projectSprite(nearest.x, nearest.y);
        impacts.push({ sx: proj ? proj.screenX : SCREEN_W / 2, sy: Math.floor(SCREEN_H * 0.45), type: "enemy", timer: 12, maxTimer: 12 });
        playSound('hit-enemy');
        if (nearest.health <= 0) { nearest.state = "dead"; kills++; showMessage("ENEMY DOWN!"); }
      } else {
        impacts.push({ sx: SCREEN_W / 2, sy: SCREEN_H / 2, type: "wall", timer: 10, maxTimer: 10 });
        playSound('hit-wall');
      }
    }

    // ── Enemy AI ───────────────────────────────────────────────────────────────
    function updateEnemies(dt: number) {
      for (const e of enemies) {
        if (e.state === "dead") continue;
        if (e.type === 3) continue;

        const dx = player.x - e.x, dy = player.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (level === 1) {
          e.x += Math.cos(e.angle) * 0.5;
          e.y += Math.sin(e.angle) * 0.5;
          if (Math.random() < 0.01) e.angle += (Math.random() - 0.5) * 1.5;
          const tx = Math.floor(e.x / CELL), ty = Math.floor(e.y / CELL);
          if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H || map[ty][tx] === TILE_WALL) {
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
          if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H || map[ty][tx] === TILE_WALL) {
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
          if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H && map[ty][tx] !== TILE_WALL) {
            e.x = nx; e.y = ny;
          } else {
            const nx2 = e.x + Math.cos(angleToPlayer) * spd;
            const tx2 = Math.floor(nx2 / CELL), ty2 = Math.floor(e.y / CELL);
            if (tx2 >= 0 && tx2 < MAP_W && ty2 >= 0 && ty2 < MAP_H && map[ty2][tx2] !== TILE_WALL) e.x = nx2;
            const ny2 = e.y + Math.sin(angleToPlayer) * spd;
            const tx3 = Math.floor(e.x / CELL), ty3 = Math.floor(ny2 / CELL);
            if (tx3 >= 0 && tx3 < MAP_W && ty3 >= 0 && ty3 < MAP_H && map[ty3][tx3] !== TILE_WALL) e.y = ny2;
          }
          if (e.muzzleFlash > 0) e.muzzleFlash = Math.max(0, e.muzzleFlash - dt * 60);
          e.shootTimer -= dt * 60;
          if (e.shootTimer <= 0 && dist < 8 * CELL && hasLOS(e.x, e.y, player.x, player.y)) {
            const dmg = [8, 15, 5][e.type];
            player.health -= dmg + Math.random() * 5;
            flashTimer = 12;
            e.muzzleFlash = 8;
            e.shootTimer = [80, 120, 50][e.type] + Math.random() * 60;
            if (hurtCooldown <= 0) {
              playSound('hurt');
              hurtCooldown = 45;
            }
            if (player.health <= 0) {
              player.health = 0;
              playSound('death');
              const stats = q("#hz-death-stats");
              stats.innerHTML = `LEVEL: ${level}<br>KILLS: ${kills} / ${totalKills}<br>AMMO REMAINING: ${player.ammo}`;
              setScreen("dead");
              if (document.pointerLockElement) document.exitPointerLock();
            }
          }
        }
      }
    }

    // ── Messages ───────────────────────────────────────────────────────────────
    function showMessage(text: string) {
      const el = q<HTMLElement>(".hz-message");
      el.textContent = text;
      el.style.opacity = "1";
      messageTimer = 120;
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
      if (e.code === "F1" || e.key === "?") {
        showHelp = !showHelp;
        updateHelpOverlay();
      }
      if (e.code === "Enter") handleEnter();
      if (e.code === "Space" && gameState === "playing") shoot();
      if (e.code === "Escape") {
        if (gameState === "playing") {
          setScreen("title");
          if (document.pointerLockElement) document.exitPointerLock();
        } else {
          quitToTos();
        }
        return;
      }
      // Init audio on first key
      initAudio();
      e.preventDefault();
    }
    function handleKeyUp(e: KeyboardEvent) { keys[e.code] = false; }

    function handleMouseDown(e: MouseEvent) {
      initAudio();
      if (gameState === "playing") {
        if (!pointerLocked) canvas.requestPointerLock();
        else shoot();
      }
      if (gameState === "title") handleEnter();
      // Left click also fires
      if (e.button === 0 && pointerLocked && gameState === "playing") shoot();
    }

    function handleMouseMove(e: MouseEvent) {
      if (pointerLocked && gameState === "playing") player.angle += e.movementX * MOUSE_SENSITIVITY;
    }

    function handlePointerLockChange() {
      pointerLocked = document.pointerLockElement === canvas;
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousedown", handleMouseDown);
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
      const fireOn  = (ev: Event) => { ev.preventDefault(); fabShoot.classList.add("pressed");    if (gameState === "playing") shoot(); };
      const fireOff = (ev: Event) => { ev.preventDefault(); fabShoot.classList.remove("pressed"); };
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
        if (gameState === "playing") {
          setScreen("title");
          if (document.pointerLockElement) document.exitPointerLock();
        } else {
          quitToTos();
        }
      };
      fabEsc.addEventListener("touchstart", doEsc, { passive: false });
      fabEsc.addEventListener("click", doEsc);
      fabCleanups.push(() => { fabEsc.removeEventListener("touchstart", doEsc); fabEsc.removeEventListener("click", doEsc); });
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
      const helpClick = () => { showHelp = !showHelp; updateHelpOverlay(); };
      helpBtn.addEventListener("click", helpClick);
      fabCleanups.push(() => helpBtn.removeEventListener("click", helpClick));
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
        updateEnemies(dt);
        if (shootCooldown > 0) shootCooldown -= dt * 60;
        if (gunRecoil > 0) gunRecoil = Math.max(0, gunRecoil - 0.15 * dt * 60);
        if (muzzleFlashTimer > 0) muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt * 60);
        if (hurtCooldown > 0) hurtCooldown -= dt * 60;
        if (messageTimer > 0) {
          messageTimer -= dt * 60;
          if (messageTimer <= 0) {
            const msgEl = root.querySelector<HTMLElement>(".hz-message");
            if (msgEl) msgEl.style.opacity = "0";
          }
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

        {/* Title screen */}
        <div className="hz-title-screen">
          <div className="hz-title-logo">HELLZONE</div>
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
            HELLZONE PRO IS SHAREWARE — COPY AND DISTRIBUTE FREELY<br />
            <span>REGISTER THE FULL GAME FOR $29.99 — CALL 1-800-HELLZNE</span><br />
            © 1994 BRIMSTONE SOFTWARE INC. — ALL RIGHTS RESERVED
          </div>
        </div>

        {/* Death screen */}
        <div className="hz-death-screen">
          <div className="hz-death-title">YOU DIED</div>
          <div className="hz-death-sub">GAME OVER, MAN</div>
          <div className="hz-death-stats" id="hz-death-stats"></div>
          <div className="hz-death-press">[ ENTER ] TRY AGAIN</div>
          <div className="hz-death-quit">[ ESC ] QUIT TO NS-TOS</div>
        </div>

        {/* Game */}
        <div className="hz-game-container">
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
          </div>
          <div className="hz-hud">
            <div className="hz-hud-panel">
              <div className="hz-hud-label">HEALTH</div>
              <div className="hz-hud-value" id="hz-hud-health">100</div>
            </div>
            <div className="hz-hud-divider" />
            <canvas ref={faceRef} className="hz-face-sprite" width={24} height={24} />
            <div className="hz-hud-divider" />
            <div className="hz-hud-panel">
              <div className="hz-hud-label">AMMO</div>
              <div className="hz-hud-value" id="hz-hud-ammo">50</div>
            </div>
            <div className="hz-hud-divider" />
            <div className="hz-hud-panel">
              <div className="hz-hud-label">KILLS</div>
              <div className="hz-hud-value" id="hz-hud-kills">0</div>
            </div>
            <canvas ref={minimapRef} className="hz-minimap" width={80} height={80} />
            <div className="hz-level-info">
              <div className="hz-hud-label">LEVEL</div>
              <div className="hz-hud-level-num" id="hz-hud-level">1</div>
              <div className="hz-hud-seed" id="hz-hud-seed"></div>
            </div>
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
        <div className="hz-fab hz-fab-shoot">FIRE</div>
      </div>
    </div>
  );
}
