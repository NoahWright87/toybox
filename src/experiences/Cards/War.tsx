import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import "./Cards.css";
import "./War.css";
import { PlayingCard } from "./PlayingCard";
import type { Card, CardAppearance, DeckSettings } from "./types";
import { buildDeck, shuffle } from "./deckUtils";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

const RANK_ORDER = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"] as const;

function warValue(card: Card): number {
  if (card.rank === "Joker") return -1;
  return RANK_ORDER.indexOf(card.rank as typeof RANK_ORDER[number]);
}

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ── Stage positions (center coords in px) ────────────────────────────────────

// Stage inner width ≈ 416px (440px window − chrome − margin − border)
// Player pile: left: 40px → center at 40+36 = 76
// Dealer pile: right: 40px → center at 416−40−36 = 340
const P = {
  player:       { x:  76, y: 108 },
  dealer:       { x: 340, y: 108 },
  deck:         { x: 208, y: 108 },
  playerBattle: { x: 155, y: 108 },
  dealerBattle: { x: 261, y: 108 },
  war:          { x: 208, y: 108 },
} as const;

const CARD_W = 72;
const CARD_H = 100;

// ── Timing base values (ms) ───────────────────────────────────────────────────

const TB = {
  SHUFFLE:   1600,
  DEAL_FLY:    85,
  DEAL_GAP:   110,
  DEAL_N:       6,   // sprites per side
  FLY:         360,
  JUDGE:       300,
  RESULT:      480,
  COLLECT:     340,
  WAR_TEXT:    650,
  WAR_FLY:     280,
  WAR_GAP:     160,
};

const WAR_SPEED_MS: Record<string, number> = { slow: 2000, normal: 900, fast: 250 };
const ANIM_MULT: Record<string, number>    = { slow: 1.35, normal: 1.0, fast: 0.5 };

// ── Types ─────────────────────────────────────────────────────────────────────

type AnimPhase =
  | "shuffle" | "dealing" | "idle"
  | "flying" | "result" | "collecting"
  | "war-text" | "war-flying" | "war-result" | "war-collecting"
  | "game-over";

interface Sprite {
  id: string;
  card: Card;
  x: number;       // center-x
  y: number;       // center-y
  rot: number;
  scale: number;
  opacity: number;
  faceDown: boolean;
  posMs: number;   // position transition duration
  zIndex: number;
  side: "player" | "dealer";
  isDecider?: boolean;
}

// ── StackedPile ───────────────────────────────────────────────────────────────

const DUMMY: Card = { id: "__dum", suit: "spades", rank: "2" };

function StackedPile({ count, appearance }: { count: number; appearance: CardAppearance }) {
  if (count === 0) return <div className="war__empty-slot" />;
  const layers = Math.min(5, count);
  return (
    <div className="war__stack">
      {Array.from({ length: layers }).map((_, i) => {
        const d = layers - 1 - i;
        return (
          <div key={i} className="war__stack-layer" style={{ left: d * -1.5, top: d * 1.5, zIndex: i }}>
            <PlayingCard card={DUMMY} faceDown appearance={appearance} />
          </div>
        );
      })}
    </div>
  );
}

// ── FlippableSprite ───────────────────────────────────────────────────────────

function FlippableSprite({ s, appearance }: { s: Sprite; appearance: CardAppearance }) {
  return (
    <div
      key={s.id}
      style={{
        position:   "absolute",
        left:       s.x - CARD_W / 2,
        top:        s.y - CARD_H / 2,
        width:      CARD_W,
        height:     CARD_H,
        zIndex:     s.zIndex,
        opacity:    s.opacity,
        transition: s.posMs > 0
          ? `left ${s.posMs}ms ease-in-out, top ${s.posMs}ms ease-in-out, opacity 200ms ease`
          : "opacity 200ms ease",
      }}
    >
      <div style={{
        width: "100%", height: "100%",
        transform: `rotate(${s.rot}deg) scale(${s.scale})`,
        transformOrigin: "center center",
        transition: "transform 200ms ease-out",
      }}>
        <div className="flippable" style={{ width: CARD_W, height: CARD_H }}>
          <div
            className={`flippable__inner${!s.faceDown ? " flippable__inner--face-up" : ""}`}
            style={{ transition: `transform ${Math.round(Math.max(200, s.posMs * 0.55))}ms ease-in-out` }}
          >
            <div className="flippable__face">
              <PlayingCard card={s.card} faceDown appearance={appearance} />
            </div>
            <div className="flippable__face flippable__face--front">
              <PlayingCard card={s.card} appearance={appearance} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── War component ─────────────────────────────────────────────────────────────

interface WarProps {
  settings: DeckSettings;
  onNewGame?: () => void;
  onQuit?: () => void;
}

export default function War({ settings, onNewGame, onQuit }: WarProps) {
  const [playerPile, setPlayerPile] = useState<Card[]>([]);
  const [dealerPile, setDealerPile] = useState<Card[]>([]);
  const [roundCount,  setRoundCount]  = useState(0);
  const [roundResult, setRoundResult] = useState<"player" | "dealer" | "war" | null>(null);
  const [gameResult,  setGameResult]  = useState<"player" | "dealer" | null>(null);
  const [animPhase,   setAnimPhase]   = useState<AnimPhase>("shuffle");
  const [sprites,     setSprites]     = useState<Sprite[]>([]);
  const [warMsg,      setWarMsg]      = useState("");
  const [shuffling,   setShuffling]   = useState(true);
  const [appearance,  setAppearance]  = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);

  // Stable refs for pile access inside timeouts
  const playerPileRef = useRef<Card[]>([]);
  const dealerPileRef = useRef<Card[]>([]);
  playerPileRef.current = playerPile;
  dealerPileRef.current = dealerPile;

  // Timer management
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timerIds.current.forEach(clearTimeout);
    timerIds.current = [];
  }, []);
  function after(ms: number, fn: () => void) {
    const id = setTimeout(fn, ms);
    timerIds.current.push(id);
  }

  // Speed helpers
  const am = ANIM_MULT[settings.warSpeed] ?? 1.0;
  function t(base: number) { return Math.round(base * am); }
  const extraPause = Math.max(0, (WAR_SPEED_MS[settings.warSpeed] ?? 900) - t(800));

  // Sprite helpers
  function patchSprites(id: string, patch: Partial<Sprite>) {
    setSprites(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }
  function addSprite(sp: Sprite) {
    setSprites(prev => [...prev, sp]);
  }

  // ── startGame ─────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    clearTimers();
    const deck = buildDeck(settings);
    const mid = Math.floor(deck.length / 2);
    const pCards = deck.slice(0, mid);
    const dCards = deck.slice(mid);

    setPlayerPile([]);
    setDealerPile([]);
    setRoundCount(0);
    setRoundResult(null);
    setGameResult(null);
    setSprites([]);
    setWarMsg("");
    setShuffling(true);
    setAnimPhase("shuffle");

    after(TB.SHUFFLE, () => {
      setShuffling(false);
      setAnimPhase("dealing");

      let flown = 0;
      const n = TB.DEAL_N;

      function dealNext() {
        if (flown >= n * 2) {
          after(t(TB.DEAL_FLY) + 60, () => {
            setPlayerPile(pCards);
            setDealerPile(dCards);
            setSprites([]);
            setAnimPhase("idle");
          });
          return;
        }
        const isPlayer = flown % 2 === 0;
        const idx = Math.floor(flown / 2);
        const card = isPlayer ? pCards[idx] : dCards[idx];
        const dest = isPlayer ? P.player : P.dealer;
        const sid = `deal-${flown}`;
        const sp: Sprite = {
          id: sid, card,
          x: P.deck.x, y: P.deck.y,
          rot: rnd(-4, 4), scale: 1, opacity: 1,
          faceDown: true, posMs: 0,
          zIndex: 80 + flown,
          side: isPlayer ? "player" : "dealer",
        };
        addSprite(sp);
        after(16, () => patchSprites(sid, { x: dest.x, y: dest.y, posMs: t(TB.DEAL_FLY) }));
        flown++;
        after(t(TB.DEAL_GAP), dealNext);
      }

      dealNext();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    startGame();
    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── flip ─────────────────────────────────────────────────────────────────

  const flip = useCallback(() => {
    const pp = playerPileRef.current;
    const dp = dealerPileRef.current;
    if (pp.length === 0 || dp.length === 0) return;

    const [pc, ...pRest] = pp;
    const [dc, ...dRest] = dp;
    const pv = warValue(pc);
    const dv = warValue(dc);
    const result: "player" | "dealer" | "war" =
      pv > dv ? "player" : pv < dv ? "dealer" : "war";

    setPlayerPile(pRest);
    setDealerPile(dRest);
    setRoundCount(c => c + 1);
    setRoundResult(result);
    setAnimPhase("flying");

    const pSp: Sprite = { id: `pb-${pc.id}`, card: pc, x: P.player.x, y: P.player.y, rot: 0, scale: 1, opacity: 1, faceDown: true, posMs: 0, zIndex: 20, side: "player" };
    const dSp: Sprite = { id: `db-${dc.id}`, card: dc, x: P.dealer.x, y: P.dealer.y, rot: 0, scale: 1, opacity: 1, faceDown: true, posMs: 0, zIndex: 21, side: "dealer" };
    setSprites([pSp, dSp]);

    // Fly to battle positions
    after(16, () => {
      patchSprites(pSp.id, { x: P.playerBattle.x, y: P.playerBattle.y, posMs: t(TB.FLY) });
      patchSprites(dSp.id, { x: P.dealerBattle.x, y: P.dealerBattle.y, posMs: t(TB.FLY) });
    });

    // Mid-flight flip to face-up
    after(t(TB.FLY) / 2, () => {
      setSprites(prev => prev.map(s => ({ ...s, faceDown: false })));
    });

    // Show result effects after landing
    after(t(TB.FLY) + t(TB.JUDGE), () => {
      setAnimPhase("result");
      if (result !== "war") {
        setSprites(prev => prev.map(s => {
          const wins = (result === "player") === (s.side === "player");
          return { ...s, scale: wins ? 1.07 : 0.93, opacity: wins ? 1 : 0.5 };
        }));
      }
    });

    const afterResult = t(TB.FLY) + t(TB.JUDGE) + t(TB.RESULT);

    if (result !== "war") {
      after(afterResult, () => {
        setAnimPhase("collecting");
        const winPos = result === "player" ? P.player : P.dealer;
        setSprites(prev => prev.map(s => ({
          ...s, x: winPos.x, y: winPos.y,
          rot: rnd(-6, 6), scale: 1, opacity: 0.75, posMs: t(TB.COLLECT),
        })));
        after(t(TB.COLLECT) + 60, () => {
          const spoils = shuffle([pc, dc]);
          if (result === "player") setPlayerPile(prev => [...prev, ...spoils]);
          else setDealerPile(prev => [...prev, ...spoils]);
          setSprites([]);

          const newPp = result === "player" ? [...pRest, ...spoils] : pRest;
          const newDp = result === "dealer" ? [...dRest, ...spoils] : dRest;
          if (newPp.length === 0) { setGameResult("dealer"); setAnimPhase("game-over"); }
          else if (newDp.length === 0) { setGameResult("player"); setAnimPhase("game-over"); }
          else setAnimPhase("idle");
        });
      });
    } else {
      // War! Move battle cards to war pile, then fly more cards
      after(afterResult, () => {
        setAnimPhase("war-text");
        setWarMsg("WAR!");
        // Scatter existing battle cards to war center
        setSprites(prev => prev.map((s, i) => ({
          ...s,
          x: P.war.x + (s.side === "player" ? -18 : 18),
          y: P.war.y + rnd(-8, 8),
          rot: rnd(-15, 15),
          scale: 1, opacity: 1, posMs: t(200),
          zIndex: 10 + i,
        })));

        after(t(TB.WAR_TEXT), () => {
          setWarMsg("I DECLARE WAR");
          doWarFly(pc, dc, pRest, dRest);
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── doWarFly ─────────────────────────────────────────────────────────────

  function doWarFly(pBattle: Card, dBattle: Card, pRest: Card[], dRest: Card[]) {
    setAnimPhase("war-flying");

    const pFdN = Math.min(3, Math.max(0, pRest.length - 1));
    const dFdN = Math.min(3, Math.max(0, dRest.length - 1));
    const pFaceDowns = pRest.slice(0, pFdN);
    const pFaceUp    = pFdN < pRest.length ? pRest[pFdN] : null;
    const pRemain    = pRest.slice(pFdN + (pFaceUp ? 1 : 0));

    const dFaceDowns = dRest.slice(0, dFdN);
    const dFaceUp    = dFdN < dRest.length ? dRest[dFdN] : null;
    const dRemain    = dRest.slice(dFdN + (dFaceUp ? 1 : 0));

    setPlayerPile(pRemain);
    setDealerPile(dRemain);

    let z = 30;
    let delay = 0;

    function flyWarCard(card: Card, side: "player" | "dealer", isDecider: boolean) {
      const sid = `war-${side}-${card.id}`;
      const startPos = side === "player" ? P.player : P.dealer;
      const offX = rnd(-22, 22);
      const offY = rnd(-14, 14);
      const targetRot = rnd(-16, 16);
      const curZ = z++;

      after(delay, () => {
        addSprite({
          id: sid, card,
          x: startPos.x, y: startPos.y,
          rot: 0, scale: 1, opacity: 1,
          faceDown: true, posMs: 0,
          zIndex: curZ, side, isDecider,
        });
        after(16, () => patchSprites(sid, {
          x: P.war.x + offX,
          y: P.war.y + offY,
          rot: targetRot,
          posMs: t(TB.WAR_FLY),
        }));
        // Flip deciding card mid-flight
        if (isDecider) {
          after(t(TB.WAR_FLY) / 2, () => patchSprites(sid, { faceDown: false }));
        }
      });

      delay += t(TB.WAR_GAP);
    }

    const maxFd = Math.max(pFdN, dFdN);
    for (let i = 0; i < maxFd; i++) {
      if (i < pFaceDowns.length) flyWarCard(pFaceDowns[i], "player", false);
      if (i < dFaceDowns.length) flyWarCard(dFaceDowns[i], "dealer", false);
    }
    if (pFaceUp) flyWarCard(pFaceUp, "player", true);
    if (dFaceUp) flyWarCard(dFaceUp, "dealer", true);

    // Determine war result
    let warResult: "player" | "dealer";
    if (!pFaceUp && !dFaceUp) {
      warResult = Math.random() < 0.5 ? "player" : "dealer";
    } else if (!pFaceUp) {
      warResult = "dealer";
    } else if (!dFaceUp) {
      warResult = "player";
    } else {
      const pv = warValue(pFaceUp);
      const dv = warValue(dFaceUp);
      warResult = pv >= dv ? "player" : "dealer"; // tiebreaker: player
    }

    const afterFly = delay + t(TB.WAR_FLY) + t(TB.JUDGE);

    after(afterFly, () => {
      setRoundCount(c => c + 1);
      setRoundResult(warResult);
      setAnimPhase("war-result");

      // Highlight deciders
      setSprites(prev => prev.map(s => {
        if (!s.isDecider) return s;
        const wins = warResult === s.side;
        return { ...s, scale: wins ? 1.07 : 0.93, opacity: wins ? 1 : 0.5 };
      }));

      after(t(TB.RESULT), () => {
        setAnimPhase("war-collecting");
        const winPos = warResult === "player" ? P.player : P.dealer;
        setSprites(prev => prev.map(s => ({
          ...s, x: winPos.x, y: winPos.y,
          rot: rnd(-6, 6), scale: 1, opacity: 0.75, posMs: t(TB.COLLECT),
        })));

        after(t(TB.COLLECT) + 60, () => {
          const allSpoils = shuffle([
            pBattle, dBattle,
            ...pFaceDowns, ...dFaceDowns,
            ...(pFaceUp ? [pFaceUp] : []),
            ...(dFaceUp ? [dFaceUp] : []),
          ]);
          if (warResult === "player") setPlayerPile(prev => [...prev, ...allSpoils]);
          else setDealerPile(prev => [...prev, ...allSpoils]);
          setSprites([]);
          setWarMsg("");

          const newPp = warResult === "player" ? [...pRemain, ...allSpoils] : pRemain;
          const newDp = warResult === "dealer" ? [...dRemain, ...allSpoils] : dRemain;
          if (newPp.length === 0) { setGameResult("dealer"); setAnimPhase("game-over"); }
          else if (newDp.length === 0) { setGameResult("player"); setAnimPhase("game-over"); }
          else setAnimPhase("idle");
        });
      });
    });
  }

  // ── Menus ─────────────────────────────────────────────────────────────────

  const menus = useMemo<MenuBarMenu[]>(() => {
    const gameItems: MenuBarMenu["items"] = [
      { label: "Restart", onClick: startGame },
      ...(onNewGame ? [{ label: "New Game", onClick: onNewGame }] : []),
      ...(onQuit ? [{ separator: true as const }, { label: "Exit", onClick: onQuit }] : []),
    ];
    return [
      { label: "Game", items: gameItems },
      { label: "Options", items: [{ label: "Card Appearance…", onClick: () => setShowDeckModal(true) }] },
    ];
  }, [startGame, onNewGame, onQuit]);

  useWindowMenus(menus);

  // ── Auto-play ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!settings.warAutoPlay || animPhase !== "idle") return;
    const id = setTimeout(flip, extraPause);
    return () => clearTimeout(id);
  }, [settings.warAutoPlay, animPhase, flip, extraPause]);

  useEffect(() => {
    if (!settings.warAutoPlay || animPhase !== "game-over") return;
    const id = setTimeout(startGame, 2500);
    return () => clearTimeout(id);
  }, [settings.warAutoPlay, animPhase, startGame]);

  // ── Render ─────────────────────────────────────────────────────────────────

  function bannerText(): string {
    if (warMsg) return warMsg;
    if (animPhase === "result" || animPhase === "collecting") {
      if (roundResult === "player") return "You win the round!";
      if (roundResult === "dealer") return "Dealer wins the round.";
    }
    if (animPhase === "war-result" || animPhase === "war-collecting") {
      if (roundResult === "player") return "You win the war!";
      if (roundResult === "dealer") return "Dealer wins the war.";
    }
    if (animPhase === "game-over") {
      return gameResult === "player" ? "YOU WIN!" : "Dealer wins.";
    }
    return "";
  }

  function bannerMod(): string {
    if (gameResult === "player" || roundResult === "player") return "win";
    if (gameResult === "dealer" || roundResult === "dealer") return "lose";
    return "war";
  }

  const playerCount = playerPile.length + sprites.filter(s => s.side === "player").length;
  const dealerCount = dealerPile.length + sprites.filter(s => s.side === "dealer").length;

  return (
    <div className="war">
      {showDeckModal && (
        <DeckModal appearance={appearance} onUpdate={setAppearance} onClose={() => setShowDeckModal(false)} />
      )}

      <div className="war__scoreboard">
        <span>Round {roundCount}</span>
        <span>You: {playerCount} cards</span>
        <span>Dealer: {dealerCount} cards</span>
      </div>

      {/* Stage: position:relative container for all animated elements */}
      <div className="war__stage">
        {/* Shuffle animation */}
        {shuffling && (
          <div className="war__shuffle">
            <div className="war__shuffle-half war__shuffle-half--l">
              <StackedPile count={20} appearance={appearance} />
            </div>
            <div className="war__shuffle-half war__shuffle-half--r">
              <StackedPile count={20} appearance={appearance} />
            </div>
          </div>
        )}

        {/* Player pile */}
        {!shuffling && (
          <div className="war__pile war__pile--player">
            <div className="war__pile-label">You</div>
            <StackedPile count={playerPile.length} appearance={appearance} />
            <div className="war__pile-count">{playerPile.length} left</div>
          </div>
        )}

        {/* VS label */}
        {!shuffling && animPhase === "idle" && (
          <div className="war__vs-label">VS</div>
        )}

        {/* Dealer pile */}
        {!shuffling && (
          <div className="war__pile war__pile--dealer">
            <div className="war__pile-label">Dealer</div>
            <StackedPile count={dealerPile.length} appearance={appearance} />
            <div className="war__pile-count">{dealerPile.length} left</div>
          </div>
        )}

        {/* Animated sprites */}
        {sprites.map(s => (
          <FlippableSprite key={s.id} s={s} appearance={appearance} />
        ))}
      </div>

      {/* Controls */}
      <div className="war__controls">
        {bannerText() && (
          <div className={`war__banner war__banner--${bannerMod()}`}>
            {bannerText()}
          </div>
        )}

        {animPhase === "idle" && !settings.warAutoPlay && (
          <button
            className="war__btn war__btn--primary"
            onClick={flip}
            disabled={playerPile.length === 0 || dealerPile.length === 0}
          >
            ▶ Flip
          </button>
        )}

        {animPhase === "game-over" && !settings.warAutoPlay && (
          <button className="war__btn war__btn--primary" onClick={startGame}>
            New Game
          </button>
        )}

        {animPhase === "game-over" && settings.warAutoPlay && (
          <div className="war__auto-notice">Starting new game…</div>
        )}
      </div>
    </div>
  );
}
