export type TileSuit = "dots" | "bamboo" | "characters" | "wind" | "dragon" | "flower";

export interface TileDesign {
  id: string;
  suit: TileSuit;
  rank?: number;
  label: string;
  asset: string; // `/mahjong-tiles/{id}.svg`
}

function numberedTiles(suit: TileSuit, prefix: string, labelFor: (rank: number) => string): TileDesign[] {
  return Array.from({ length: 9 }, (_, i) => {
    const rank = i + 1;
    return {
      id: `${prefix}-${rank}`,
      suit,
      rank,
      label: labelFor(rank),
      asset: `/mahjong-tiles/${prefix}-${rank}.svg`,
    };
  });
}

export const TILE_DESIGNS: TileDesign[] = [
  ...numberedTiles("dots", "dots", (rank) => `${rank} Dot${rank === 1 ? "" : "s"}`),
  ...numberedTiles("bamboo", "bamboo", (rank) => `${rank} Bamboo`),
  ...numberedTiles("characters", "chars", (rank) => `${rank} Character`),
  { id: "wind-east", suit: "wind", label: "East Wind", asset: "/mahjong-tiles/wind-east.svg" },
  { id: "wind-south", suit: "wind", label: "South Wind", asset: "/mahjong-tiles/wind-south.svg" },
  { id: "wind-west", suit: "wind", label: "West Wind", asset: "/mahjong-tiles/wind-west.svg" },
  { id: "wind-north", suit: "wind", label: "North Wind", asset: "/mahjong-tiles/wind-north.svg" },
  { id: "dragon-red", suit: "dragon", label: "Red Dragon", asset: "/mahjong-tiles/dragon-red.svg" },
  { id: "dragon-green", suit: "dragon", label: "Green Dragon", asset: "/mahjong-tiles/dragon-green.svg" },
  { id: "dragon-white", suit: "dragon", label: "White Dragon", asset: "/mahjong-tiles/dragon-white.svg" },
  { id: "flower-1", suit: "flower", label: "Flower 1", asset: "/mahjong-tiles/flower-1.svg" },
  { id: "flower-2", suit: "flower", label: "Flower 2", asset: "/mahjong-tiles/flower-2.svg" },
];

export const TILE_DESIGNS_BY_ID: Record<string, TileDesign> = Object.fromEntries(
  TILE_DESIGNS.map((design) => [design.id, design])
);

/**
 * Returns 144 tile ids: each of the 36 design ids repeated 4 times, in
 * design-order (NOT shuffled). Callers are responsible for arranging/
 * assigning these to board slots.
 */
export function buildTileDeck(): string[] {
  const deck: string[] = [];
  for (const design of TILE_DESIGNS) {
    for (let i = 0; i < 4; i++) deck.push(design.id);
  }
  return deck;
}
