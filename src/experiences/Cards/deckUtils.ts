import type { Card, DeckSettings, Rank } from "./types";

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function buildDeck(settings: DeckSettings): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < settings.numDecks; d++) {
    for (const suit of settings.suits) {
      for (const rank of RANKS) {
        cards.push({ suit, rank, id: `${d}-${suit}-${rank}` });
      }
    }
    if (settings.includeJokers) {
      cards.push({ suit: "joker", rank: "Joker", id: `${d}-joker-red` });
      cards.push({ suit: "joker", rank: "Joker", id: `${d}-joker-black` });
    }
  }
  return shuffle(cards);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function totalCards(settings: DeckSettings): number {
  const perDeck = settings.suits.length * 13 + (settings.includeJokers ? 2 : 0);
  return settings.numDecks * perDeck;
}
