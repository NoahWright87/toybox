export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  suit: Suit | "joker";
  rank: Rank | "Joker";
  id: string;
}

export type BackPattern = "crosshatch" | "diagonal" | "diamonds" | "noahsoft";
export type CardFaceStyle = "classic" | "minimal" | "large-index";
export type WarSpeed = "slow" | "normal" | "fast";
export type MemoryDifficulty = "easy" | "medium" | "hard";

export interface CardAppearance {
  backPrimaryColor: string;
  backSecondaryColor: string;
  backPattern: BackPattern;
  backImageUrl: string | null;
  fourColorSuits: boolean;
  cardFaceStyle: CardFaceStyle;
}

export interface DeckSettings {
  numDecks: number;
  suits: Suit[];
  includeJokers: boolean;
  appearance: CardAppearance;
  warAutoPlay: boolean;
  warSpeed: WarSpeed;
  memoryDifficulty: MemoryDifficulty;
  klondikeDraw: 1 | 3;
}

export type CardsGame =
  | "war"
  | "blackjack"
  | "pyramid"
  | "memory"
  | "klondike"
  | "freecell"
  | "hearts";

export const DEFAULT_APPEARANCE: CardAppearance = {
  backPrimaryColor: "#cc4400",
  backSecondaryColor: "#ffffff",
  backPattern: "crosshatch",
  backImageUrl: null,
  fourColorSuits: false,
  cardFaceStyle: "classic",
};

export const DEFAULT_DECK_SETTINGS: DeckSettings = {
  numDecks: 1,
  suits: ["spades", "hearts", "diamonds", "clubs"],
  includeJokers: false,
  appearance: DEFAULT_APPEARANCE,
  warAutoPlay: false,
  warSpeed: "normal",
  memoryDifficulty: "easy",
  klondikeDraw: 1,
};
