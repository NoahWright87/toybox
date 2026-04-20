export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  suit: Suit | "joker";
  rank: Rank | "Joker";
  id: string;
}

export interface CardBackColor {
  label: string;
  color: string;
}

export const CARD_BACK_COLORS: CardBackColor[] = [
  { label: "Orange",  color: "#cc4400" },
  { label: "Purple",  color: "#5b2d8e" },
  { label: "Blue",    color: "#1a4a8a" },
  { label: "Green",   color: "#1a5c2a" },
  { label: "Red",     color: "#8a1a1a" },
  { label: "Black",   color: "#1a1a1a" },
];

export type WarSpeed = "slow" | "normal" | "fast";

export interface DeckSettings {
  numDecks: number;
  suits: Suit[];
  includeJokers: boolean;
  cardBack: string;
  warAutoPlay: boolean;
  warSpeed: WarSpeed;
}

export type CardsGame = "war" | "blackjack" | "pyramid";

export const DEFAULT_DECK_SETTINGS: DeckSettings = {
  numDecks: 1,
  suits: ["spades", "hearts", "diamonds", "clubs"],
  includeJokers: false,
  cardBack: "#cc4400",
  warAutoPlay: false,
  warSpeed: "normal",
};
