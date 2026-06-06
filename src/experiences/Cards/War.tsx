import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import "./Cards.css";
import "./War.css";
import type { Card, CardAppearance, DeckSettings } from "./types";
import { PermCard } from "./PermCard";
import { buildDeck, shuffle } from "./deckUtils";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { DeckModal } from "./DeckModal";
import { CardStack } from "./cardStack";
import type { CardVisualState } from "./cardStack";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RANK_ORDER = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"] as const;

function warValue(card: Card): number {
  if (card.rank === "Joker") return -1;
  return RANK_ORDER.indexOf(card.rank as typeof RANK_ORDER[number]);
}

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ─── Stage constants ──────────────────────────────────────────────────────────

const STAGE_W = 420;
const STAGE_H = 240;
const CY = STAGE_H / 2;  // vertical center of stage

const PLAYER_X = 76;
const DEALER_X = 340;
const WAR_X    = 208;

// Battle zone (not stacks — fixed positions)
const BP_X = 155;   // player battle card center-x
const BD_X = 261;   // dealer battle card center-x
const Z_BP  = 500;  // tier 5
const Z_BD  = 600;  // tier 6

const ANIM_MULT: Record<string, number> = { slow: 1.5, normal: 1.0, fast: 0.5 };

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "shuffle" | "idle" | "animating" | "game-over";
type BannerType = "win" | "lose" | "war";

// ─── War ──────────────────────────────────────────────────────────────────────

interface WarProps {
  settings: DeckSettings;
  onNewGame?: () => void;
  onQuit?: () => void;
}

export default function War({ settings, onNewGame, onQuit }: WarProps) {
  const [allCards,      setAllCards]      = useState<Card[]>([]);
  const [cardStates,    setCardStates]    = useState<Record<string, CardVisualState>>({});
  const [phase,         setPhase]         = useState<Phase>("shuffle");
  const [playerCount,   setPlayerCount]   = useState(0);
  const [dealerCount,   setDealerCount]   = useState(0);
  const [roundCount,    setRoundCount]    = useState(0);
  const [banner,        setBanner]        = useState("");
  const [bannerType,    setBannerType]    = useState<BannerType>("win");
  const [appearance,    setAppearance]    = useState<CardAppearance>(settings.appearance);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [scale,         setScale]         = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Card stacks — mutable refs, never triggers re-renders themselves
  const ps = useRef(new CardStack({ zTier: 1, baseX: PLAYER_X, baseY: CY, offsetX:  0.5, offsetY: -0.5 }));
  const ds = useRef(new CardStack({ zTier: 2, baseX: DEALER_X, baseY: CY, offsetX: -0.5, offsetY: -0.5 }));
  const ws = useRef(new CardStack({ zTier: 8, baseX: WAR_X,    baseY: CY, offsetX:  2.0, offsetY:  0.5 }));

  // Timer tracking for cleanup
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  function after(ms: number, fn: () => void): void {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      setScale(Math.min(1, w / STAGE_W));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const am = ANIM_MULT[settings.warSpeed] ?? 1.0;
  function t(ms: number): number { return Math.round(ms * am); }

  // Patch specific card states by id
  function patchCards(patches: Record<string, Partial<CardVisualState>>): void {
    setCardStates(prev => {
      const next = { ...prev };
      for (const [id, p] of Object.entries(patches)) {
        if (next[id]) next[id] = { ...next[id], ...p };
      }
      return next;
    });
  }

  // Merge one or more layout records into cardStates
  function applyLayouts(...layouts: Record<string, CardVisualState>[]): void {
    setCardStates(prev => {
      const next = { ...prev };
      for (const layout of layouts) Object.assign(next, layout);
      return next;
    });
  }

  // ── startGame ──────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    clearTimers();

    const deck = buildDeck(settings);
    const mid  = Math.floor(deck.length / 2);
    const pCards = deck.slice(0, mid);
    const dCards = deck.slice(mid);

    ps.current.clear();
    ds.current.clear();
    ws.current.clear();

    setRoundCount(0);
    setPlayerCount(0);
    setDealerCount(0);
    setBanner("");
    setPhase("shuffle");

    // Step 0: All cards stacked at deck center (instant — no transition)
    const initStates: Record<string, CardVisualState> = {};
    for (const card of deck) {
      initStates[card.id] = { x: WAR_X, y: CY, z: 10, rotation: 0, faceDown: true, transitionMs: 0 };
    }
    setAllCards(deck);
    setCardStates(initStates);

    // Timing — all scaled by speed multiplier
    const SPLIT   = t(280);
    const PAUSE   = t(80);
    const MERGE   = t(200);
    const STAGGER = t(8);    // per-card delay in merge for riffle effect
    const DEAL    = t(380);
    // Total merge animation = MERGE + last card's delay
    const MERGE_TOTAL = MERGE + (deck.length - 1) * STAGGER;
    let now = 80;  // initial paint delay so browser renders the "all at center" frame first

    // Helper: interleave cards from two halves (left[0], right[0], left[1], right[1], ...)
    // then build merge states with per-card stagger
    function mergeStates(cards1: Card[], cards2: Card[]): Record<string, CardVisualState> {
      const interleaved: Card[] = [];
      const len = Math.max(cards1.length, cards2.length);
      for (let i = 0; i < len; i++) {
        if (i < cards1.length) interleaved.push(cards1[i]);
        if (i < cards2.length) interleaved.push(cards2[i]);
      }
      const states: Record<string, CardVisualState> = {};
      interleaved.forEach((card, i) => {
        states[card.id] = {
          x: WAR_X, y: CY, z: 10 + i,
          rotation: rnd(-5, 5), faceDown: true,
          transitionMs: MERGE, transitionDelay: i * STAGGER,
        };
      });
      return states;
    }

    // Step 1: Split deck into two halves (pCards left, dCards right)
    after(now, () => {
      const states: Record<string, CardVisualState> = {};
      pCards.forEach((card, i) => {
        states[card.id] = { x: 130 + i * 0.5, y: CY - i * 0.5, z: 300 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
      });
      dCards.forEach((card, i) => {
        states[card.id] = { x: 286 - i * 0.5, y: CY - i * 0.5, z: 400 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
      });
      setCardStates(states);
    });
    now += SPLIT + PAUSE;

    // Step 2: Merge — cards riffle together one by one
    after(now, () => setCardStates(mergeStates(pCards, dCards)));
    now += MERGE_TOTAL + PAUSE;

    // Step 3: Split again (slightly tighter spread)
    after(now, () => {
      const states: Record<string, CardVisualState> = {};
      pCards.forEach((card, i) => {
        states[card.id] = { x: 136 + i * 0.4, y: CY - i * 0.4, z: 300 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
      });
      dCards.forEach((card, i) => {
        states[card.id] = { x: 280 - i * 0.4, y: CY - i * 0.4, z: 400 + i, rotation: rnd(-2, 2), faceDown: true, transitionMs: SPLIT };
      });
      setCardStates(states);
    });
    now += SPLIT + PAUSE;

    // Step 4: Merge again with riffle
    after(now, () => setCardStates(mergeStates(pCards, dCards)));
    now += MERGE_TOTAL + PAUSE;

    // Step 5: Deal — all cards fan out to their pile positions (no stagger, clean spread)
    after(now, () => {
      for (const card of pCards) ps.current.addCard(card, { toTop: true, faceDown: true });
      for (const card of dCards) ds.current.addCard(card, { toTop: true, faceDown: true });

      setPlayerCount(ps.current.size);
      setDealerCount(ds.current.size);
      // transitionDelay resets to 0 since layout() doesn't set it
      setCardStates({ ...ps.current.layout(DEAL), ...ds.current.layout(DEAL) });

      after(DEAL + 100, () => setPhase("idle"));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    startGame();
    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── flip ──────────────────────────────────────────────────────────────────

  const flip = useCallback(() => {
    if (ps.current.size === 0 || ds.current.size === 0) return;
    setPhase("animating");
    setBanner("");

    const pCard = ps.current.removeTop()!;
    const dCard = ds.current.removeTop()!;
    const pv = warValue(pCard);
    const dv = warValue(dCard);
    const result: "player" | "dealer" | "war" =
      pv > dv ? "player" : pv < dv ? "dealer" : "war";

    setRoundCount(c => c + 1);
    setPlayerCount(ps.current.size);
    setDealerCount(ds.current.size);

    const FLY     = t(350);
    const JUDGE   = t(200);
    const SHOW    = t(600);
    const COLLECT = t(350);

    // Step 1: Fly both cards to battle zone (face-down, with transition)
    setCardStates(prev => ({
      ...prev,
      ...ps.current.layout(FLY),
      ...ds.current.layout(FLY),
      [pCard.id]: { x: BP_X, y: CY, z: Z_BP, rotation: 0, faceDown: true, transitionMs: FLY },
      [dCard.id]: { x: BD_X, y: CY, z: Z_BD, rotation: 0, faceDown: true, transitionMs: FLY },
    }));

    // Step 2: Flip both cards mid-flight
    after(FLY / 2, () => {
      patchCards({
        [pCard.id]: { faceDown: false },
        [dCard.id]: { faceDown: false },
      });
    });

    // Step 3: Show round result
    after(FLY + JUDGE, () => {
      if (result === "player") {
        setBanner("You win the round!"); setBannerType("win");
      } else if (result === "dealer") {
        setBanner("Dealer wins the round."); setBannerType("lose");
      } else {
        setBanner("WAR!"); setBannerType("war");
      }
    });

    if (result !== "war") {
      // Step 4: Collect won cards to bottom of winner pile
      after(FLY + JUDGE + SHOW, () => {
        const spoils  = shuffle([pCard, dCard]);
        const winner  = result === "player" ? ps.current : ds.current;
        winner.addCard(spoils[0], { toTop: false, faceDown: true, rotation: rnd(-5, 5) });
        winner.addCard(spoils[1], { toTop: false, faceDown: true, rotation: rnd(-5, 5) });

        setPlayerCount(ps.current.size);
        setDealerCount(ds.current.size);
        setBanner("");

        // Update winner's layout — won cards animate FROM battle zone TO pile bottom
        applyLayouts(winner.layout(COLLECT));

        after(COLLECT + 100, () => {
          if (ps.current.size === 0) {
            setPhase("game-over"); setBanner("Dealer wins."); setBannerType("lose");
          } else if (ds.current.size === 0) {
            setPhase("game-over"); setBanner("YOU WIN!"); setBannerType("win");
          } else {
            setPhase("idle");
          }
        });
      });
    } else {
      // WAR — short pause before escalation
      after(FLY + JUDGE + t(400), () => doWar(pCard, dCard));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── doWar ─────────────────────────────────────────────────────────────────

  function doWar(pCard: Card, dCard: Card): void {
    setBanner("I DECLARE WAR");
    setBannerType("war");

    const WAR_FLY     = t(350);
    const WAR_COLLECT = t(350);

    ws.current.clear();

    // Scatter the two battle cards to war pile at center
    ws.current.addCard(pCard, { toTop: true, faceDown: true, rotation: rnd(-15, 15) });
    ws.current.addCard(dCard, { toTop: true, faceDown: true, rotation: rnd(-15, 15) });

    // Pull up to 3 face-down cards + 1 deciding card from each pile
    const pFdN = Math.min(3, Math.max(0, ps.current.size - 1));
    const dFdN = Math.min(3, Math.max(0, ds.current.size - 1));

    const pFaceDowns: Card[] = [];
    for (let i = 0; i < pFdN; i++) {
      const c = ps.current.removeTop();
      if (c) pFaceDowns.push(c);
    }
    const pDecider = ps.current.removeTop();  // may be null if pile exhausted

    const dFaceDowns: Card[] = [];
    for (let i = 0; i < dFdN; i++) {
      const c = ds.current.removeTop();
      if (c) dFaceDowns.push(c);
    }
    const dDecider = ds.current.removeTop();

    for (const c of pFaceDowns) ws.current.addCard(c, { toTop: true, faceDown: true, rotation: rnd(-20, 20) });
    for (const c of dFaceDowns) ws.current.addCard(c, { toTop: true, faceDown: true, rotation: rnd(-20, 20) });

    setPlayerCount(ps.current.size + (pDecider ? 1 : 0));
    setDealerCount(ds.current.size + (dDecider ? 1 : 0));

    // Fly all face-down war cards to war pile simultaneously
    setCardStates(prev => ({
      ...prev,
      ...ps.current.layout(WAR_FLY),
      ...ds.current.layout(WAR_FLY),
      ...ws.current.layout(WAR_FLY),
    }));

    // Fly deciders slightly after face-downs
    after(t(200), () => {
      if (pDecider) ws.current.addCard(pDecider, { toTop: true, faceDown: true, rotation: rnd(-10, 10) });
      if (dDecider) ws.current.addCard(dDecider, { toTop: true, faceDown: true, rotation: rnd(-10, 10) });

      setPlayerCount(ps.current.size);
      setDealerCount(ds.current.size);

      setCardStates(prev => ({ ...prev, ...ws.current.layout(WAR_FLY) }));

      // Flip deciders mid-flight
      after(WAR_FLY / 2, () => {
        const patches: Record<string, Partial<CardVisualState>> = {};
        if (pDecider) patches[pDecider.id] = { faceDown: false };
        if (dDecider) patches[dDecider.id] = { faceDown: false };
        if (Object.keys(patches).length > 0) patchCards(patches);
      });

      // Resolve war after deciders land
      after(WAR_FLY + t(300), () => {
        let warResult: "player" | "dealer";
        if (!pDecider && !dDecider) {
          warResult = Math.random() < 0.5 ? "player" : "dealer";
        } else if (!pDecider) {
          warResult = "dealer";
        } else if (!dDecider) {
          warResult = "player";
        } else {
          warResult = warValue(pDecider) >= warValue(dDecider) ? "player" : "dealer";
        }

        setRoundCount(c => c + 1);
        setBanner(warResult === "player" ? "You win the war!" : "Dealer wins the war.");
        setBannerType(warResult === "player" ? "win" : "lose");

        after(t(600), () => {
          const allWarCards = ws.current.cards;
          ws.current.clear();

          const winner  = warResult === "player" ? ps.current : ds.current;
          const shuffled = shuffle(allWarCards);
          for (const c of shuffled) {
            winner.addCard(c, { toTop: false, faceDown: true, rotation: rnd(-6, 6) });
          }

          setPlayerCount(ps.current.size);
          setDealerCount(ds.current.size);
          setBanner("");
          applyLayouts(winner.layout(WAR_COLLECT));

          after(WAR_COLLECT + 100, () => {
            if (ps.current.size === 0) {
              setPhase("game-over"); setBanner("Dealer wins."); setBannerType("lose");
            } else if (ds.current.size === 0) {
              setPhase("game-over"); setBanner("YOU WIN!"); setBannerType("win");
            } else {
              setPhase("idle");
            }
          });
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
    if (!settings.warAutoPlay || phase !== "idle") return;
    const delay = Math.round(500 * (ANIM_MULT[settings.warSpeed] ?? 1.0));
    const id = setTimeout(flip, delay);
    return () => clearTimeout(id);
  }, [settings.warAutoPlay, settings.warSpeed, phase, flip]);

  useEffect(() => {
    if (!settings.warAutoPlay || phase !== "game-over") return;
    const id = setTimeout(startGame, 2500);
    return () => clearTimeout(id);
  }, [settings.warAutoPlay, phase, startGame]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="war">
      {showDeckModal && (
        <DeckModal
          appearance={appearance}
          onUpdate={setAppearance}
          onClose={() => setShowDeckModal(false)}
        />
      )}

      <div className="war__scoreboard">
        <span>Round {roundCount}</span>
        <span>You: {playerCount}</span>
        <span>Dealer: {dealerCount}</span>
      </div>

      <div className="war__stage-container" ref={containerRef} style={{ height: Math.round(STAGE_H * scale) }}>
        <div
          className="war__stage"
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
          }}
        >
          {/* VS label when waiting for flip */}
          {phase === "idle" && <div className="war__vs-label">VS</div>}

          {/* All 52 cards — permanently mounted, CSS transitions drive all animation */}
          {allCards.map(card => {
            const cs = cardStates[card.id];
            if (!cs) return null;
            return <PermCard key={card.id} card={card} cs={cs} appearance={appearance} />;
          })}
        </div>
      </div>

      <div className="war__controls">
        {banner && (
          <div className={`war__banner war__banner--${bannerType}`}>
            {banner}
          </div>
        )}

        {phase === "idle" && !settings.warAutoPlay && (
          <button
            className="war__btn war__btn--primary"
            onClick={flip}
            disabled={playerCount === 0 || dealerCount === 0}
          >
            ▶ Flip
          </button>
        )}

        {phase === "game-over" && !settings.warAutoPlay && (
          <button className="war__btn war__btn--primary" onClick={startGame}>
            New Game
          </button>
        )}

        {phase === "game-over" && settings.warAutoPlay && (
          <div className="war__auto-notice">Starting new game…</div>
        )}
      </div>
    </div>
  );
}
