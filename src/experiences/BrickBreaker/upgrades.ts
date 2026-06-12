import type { Difficulty } from "./levelGen";

// ── Permanent upgrade definitions ────────────────────────────────────────────
export type UpgradeId =
  | "wide-paddle"
  | "quick-paddle"
  | "vitality"
  | "heavy-ball"
  | "magnet"
  | "greed"
  | "homing"
  | "extra-ball"
  | "lucky";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;
  maxStacks: number;
  baseCost: number;
  costGrowth: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: "wide-paddle", name: "Wide Paddle", description: "+10 paddle width", icon: "↔", maxStacks: 5, baseCost: 8, costGrowth: 1.5 },
  { id: "quick-paddle", name: "Quick Hands", description: "Paddle moves faster", icon: "⚡", maxStacks: 4, baseCost: 8, costGrowth: 1.5 },
  { id: "vitality", name: "Vitality", description: "+1 max life, heals 1 life", icon: "♥", maxStacks: 3, baseCost: 15, costGrowth: 1.8 },
  { id: "heavy-ball", name: "Heavy Ball", description: "Ball deals +1 damage to bricks", icon: "●", maxStacks: 3, baseCost: 14, costGrowth: 1.7 },
  { id: "magnet", name: "Coin Magnet", description: "+10 pickup catch radius", icon: "🧲", maxStacks: 5, baseCost: 6, costGrowth: 1.4 },
  { id: "greed", name: "Greed", description: "+15% score, +5% ball speed", icon: "$", maxStacks: 5, baseCost: 10, costGrowth: 1.5 },
  { id: "homing", name: "Homing Ball", description: "Ball curves toward bricks", icon: "◎", maxStacks: 1, baseCost: 30, costGrowth: 1 },
  { id: "extra-ball", name: "Extra Ball", description: "+1 starting ball each level", icon: "○", maxStacks: 2, baseCost: 25, costGrowth: 2 },
  { id: "lucky", name: "Lucky", description: "+4% power-up & coin drop chance", icon: "🍀", maxStacks: 5, baseCost: 7, costGrowth: 1.4 },
];

export function getUpgrade(id: UpgradeId): UpgradeDef {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) throw new Error(`Unknown upgrade: ${id}`);
  return def;
}

export type UpgradeCounts = Record<UpgradeId, number>;

export function emptyUpgradeCounts(): UpgradeCounts {
  const counts: Partial<UpgradeCounts> = {};
  for (const def of UPGRADES) counts[def.id] = 0;
  return counts as UpgradeCounts;
}

export function upgradeCost(def: UpgradeDef, owned: number, priceMult: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, owned) * priceMult);
}

// ── Reroll cost ───────────────────────────────────────────────────────────────
export const REROLL_BASE_COST = 4;

export function rerollCost(rerollsUsed: number, priceMult: number): number {
  return Math.round((REROLL_BASE_COST + rerollsUsed * 3) * priceMult);
}

// ── Derived stats ────────────────────────────────────────────────────────────
export interface DerivedStats {
  paddleWidthBonus: number;
  paddleLerpBonus: number;
  paddleKeyboardBonus: number;
  maxLivesBonus: number;
  ballDamageBonus: number;
  magnetRadiusBonus: number;
  scoreMultiplier: number;
  ballSpeedMultiplier: number;
  homing: boolean;
  extraBalls: number;
  dropChanceBonus: number;
}

export function computeDerivedStats(counts: UpgradeCounts): DerivedStats {
  return {
    paddleWidthBonus: counts["wide-paddle"] * 10,
    paddleLerpBonus: counts["quick-paddle"] * 0.05,
    paddleKeyboardBonus: counts["quick-paddle"] * 60,
    maxLivesBonus: counts.vitality,
    ballDamageBonus: counts["heavy-ball"],
    magnetRadiusBonus: counts.magnet * 10,
    scoreMultiplier: 1 + counts.greed * 0.15,
    ballSpeedMultiplier: 1 + counts.greed * 0.05,
    homing: counts.homing > 0,
    extraBalls: counts["extra-ball"],
    dropChanceBonus: counts.lucky * 0.04,
  };
}

// ── Shop offer generation ────────────────────────────────────────────────────
export interface ShopOffer {
  def: UpgradeDef;
  cost: number;
}

export function rollShopOffers(
  counts: UpgradeCounts,
  rng: () => number,
  difficulty: { priceMult: number },
  count: number = 3
): ShopOffer[] {
  const eligible = UPGRADES.filter((u) => counts[u.id] < u.maxStacks);
  const pool = [...eligible];
  const offers: ShopOffer[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    const def = pool.splice(idx, 1)[0];
    offers.push({ def, cost: upgradeCost(def, counts[def.id], difficulty.priceMult) });
  }
  return offers;
}

// ── Persistence ───────────────────────────────────────────────────────────────
export interface SaveData {
  highScore: number;
  bestLevel: number;
  gamesPlayed: number;
  paddleColor: string;
  difficulty: Difficulty;
}

export const DEFAULT_SAVE: SaveData = {
  highScore: 0,
  bestLevel: 0,
  gamesPlayed: 0,
  paddleColor: "orange",
  difficulty: "normal",
};

export function parseSaveData(raw: string | undefined): SaveData {
  if (!raw) return { ...DEFAULT_SAVE };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "number") return { ...DEFAULT_SAVE, highScore: parsed };
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_SAVE };
    const obj = parsed as Partial<SaveData>;
    return {
      highScore: typeof obj.highScore === "number" ? obj.highScore : 0,
      bestLevel: typeof obj.bestLevel === "number" ? obj.bestLevel : 0,
      gamesPlayed: typeof obj.gamesPlayed === "number" ? obj.gamesPlayed : 0,
      paddleColor: typeof obj.paddleColor === "string" ? obj.paddleColor : DEFAULT_SAVE.paddleColor,
      difficulty: obj.difficulty === "easy" || obj.difficulty === "hard" ? obj.difficulty : "normal",
    };
  } catch {
    const legacy = parseInt(raw, 10);
    if (!isNaN(legacy)) return { ...DEFAULT_SAVE, highScore: legacy };
    return { ...DEFAULT_SAVE };
  }
}
