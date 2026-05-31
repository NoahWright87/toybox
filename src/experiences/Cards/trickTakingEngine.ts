import type { Card, Suit } from "./types";

export interface TrickPlay {
  playerIndex: number;
  card: Card;
}

const RANK_VALUES: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

export function rankValue(rank: string): number {
  return RANK_VALUES[rank] ?? 0;
}

export function dealHands(deck: Card[], numPlayers: number): Card[][] {
  const hands: Card[][] = Array.from({ length: numPlayers }, () => [] as Card[]);
  deck.forEach((card, i) => {
    hands[i % numPlayers].push(card);
  });
  return hands;
}

export function getValidHeartPlays(
  hand: Card[],
  ledSuit: Suit | null,
  heartsAreBroken: boolean,
  isFirstTrick: boolean,
): Card[] {
  if (ledSuit) {
    const suitCards = hand.filter((c) => c.suit === ledSuit);
    if (suitCards.length > 0) return suitCards;
    // Can't follow suit; can't play hearts/QoS on trick 1 if avoidable
    if (isFirstTrick) {
      const safe = hand.filter(
        (c) => c.suit !== "hearts" && !(c.suit === "spades" && c.rank === "Q"),
      );
      if (safe.length > 0) return safe;
    }
    return hand;
  }
  // Leading — block hearts until broken (unless hand is all hearts)
  if (!heartsAreBroken) {
    const nonHearts = hand.filter((c) => c.suit !== "hearts");
    if (nonHearts.length > 0) return nonHearts;
  }
  return hand;
}

export function resolveTrick(trick: TrickPlay[], ledSuit: Suit): number {
  let winnerIdx = 0;
  let winnerVal = -1;
  for (const play of trick) {
    if (play.card.suit === ledSuit) {
      const v = rankValue(play.card.rank as string);
      if (v > winnerVal) {
        winnerVal = v;
        winnerIdx = play.playerIndex;
      }
    }
  }
  return winnerIdx;
}

export function heartPoints(card: Card): number {
  if (card.suit === "hearts") return 1;
  if (card.suit === "spades" && card.rank === "Q") return 13;
  return 0;
}

export function trickPoints(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + heartPoints(c), 0);
}
