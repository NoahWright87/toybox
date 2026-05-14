import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import "./InternetApp.css";

const HOME_URL = "__home__";
const HOME_DISPLAY = "about:home";

const FAVORITES = [
  { url: "https://noahwright.dev",        display: "noahwright.dev",        description: "Doors creator's site" },
  { url: "https://design.noahwright.dev", display: "design.noahwright.dev", description: "Web components"      },
  { url: "https://lee.noahwright.dev",    display: "lee.noahwright.dev",    description: "Lee Game"            },
] as const;

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === HOME_DISPLAY) return HOME_URL;
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return "https://" + trimmed;
  }
  return trimmed;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return url;
  }
}

function generateRevealPlan(): Array<{ delay: number; reveal: number }> {
  const steps: Array<{ delay: number; reveal: number }> = [];
  let remaining = 100;
  while (remaining > 0.5) {
    const chunk = Math.min(remaining, 0.5 + Math.random() * 4.5);
    const isStall = Math.random() < 0.1;
    const delay = isStall
      ? 400 + Math.random() * 600
      : 30 + Math.random() * 250;
    steps.push({ delay, reveal: chunk });
    remaining -= chunk;
  }
  return steps;
}

export default function InternetApp() {
  const [inputValue, setInputValue] = useState(HOME_DISPLAY);
  const [history, setHistory] = useState<string[]>([HOME_URL]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [turboMode, setTurboMode] = useState(false);
  const [revealPct, setRevealPct] = useState(100);
  const [fakeKbReceived, setFakeKbReceived] = useState(0);
  const [fakeKbTotal, setFakeKbTotal] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cancelRevealRef = useRef<(() => void) | null>(null);

  const currentUrl = history[historyIdx];
  const isHome = currentUrl === HOME_URL;
  const isRevealing = !isHome && !isLoading && revealPct < 100;

  const cancelReveal = useCallback(() => {
    if (cancelRevealRef.current) {
      cancelRevealRef.current();
      cancelRevealRef.current = null;
    }
  }, []);

  const beginReveal = useCallback(() => {
    cancelReveal();
    let cancelled = false;
    cancelRevealRef.current = () => { cancelled = true; };

    const totalKb = 50 + Math.random() * 200;
    setFakeKbTotal(totalKb);
    setFakeKbReceived(0);
    setRevealPct(0);

    const plan = generateRevealPlan();
    let stepIdx = 0;
    let currentPct = 0;

    const tick = () => {
      if (cancelled) return;
      if (stepIdx >= plan.length) {
        setRevealPct(100);
        setFakeKbReceived(totalKb);
        cancelRevealRef.current = null;
        return;
      }
      const step = plan[stepIdx++];
      currentPct = Math.min(100, currentPct + step.reveal);
      setRevealPct(currentPct);
      setFakeKbReceived((currentPct / 100) * totalKb);
      setTimeout(tick, step.delay);
    };

    setTimeout(tick, 50);
  }, [cancelReveal]);

  useEffect(() => () => cancelReveal(), [cancelReveal]);

  const navigateTo = useCallback(
    (url: string) => {
      cancelReveal();
      setHistory((prev) => [...prev.slice(0, historyIdx + 1), url]);
      setHistoryIdx((i) => i + 1);
      setInputValue(url === HOME_URL ? HOME_DISPLAY : url);
      setIsLoading(url !== HOME_URL);
      setRevealPct(url === HOME_URL ? 100 : 0);
      setFrameKey((k) => k + 1);
    },
    [historyIdx, cancelReveal]
  );

  const handleGo = useCallback(() => {
    navigateTo(normalizeUrl(inputValue));
  }, [inputValue, navigateTo]);

  const handleBack = useCallback(() => {
    if (historyIdx <= 0) return;
    cancelReveal();
    const newIdx = historyIdx - 1;
    const url = history[newIdx];
    setHistoryIdx(newIdx);
    setInputValue(url === HOME_URL ? HOME_DISPLAY : url);
    setIsLoading(url !== HOME_URL);
    setRevealPct(url === HOME_URL ? 100 : 0);
    setFrameKey((k) => k + 1);
  }, [history, historyIdx, cancelReveal]);

  const handleForward = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    cancelReveal();
    const newIdx = historyIdx + 1;
    const url = history[newIdx];
    setHistoryIdx(newIdx);
    setInputValue(url === HOME_URL ? HOME_DISPLAY : url);
    setIsLoading(url !== HOME_URL);
    setRevealPct(url === HOME_URL ? 100 : 0);
    setFrameKey((k) => k + 1);
  }, [history, historyIdx, cancelReveal]);

  const handleStop = useCallback(() => {
    try { iframeRef.current?.contentWindow?.stop(); } catch (_) {}
    cancelReveal();
    setIsLoading(false);
    setRevealPct(100);
  }, [cancelReveal]);

  const handleRefresh = useCallback(() => {
    if (isHome) return;
    cancelReveal();
    setIsLoading(true);
    setRevealPct(0);
    setFrameKey((k) => k + 1);
  }, [isHome, cancelReveal]);

  const handleIframeLoad = useCallback(() => {
    try {
      const href = iframeRef.current?.contentWindow?.location?.href;
      if (href && href !== "about:blank") setInputValue(href);
    } catch (_) {
      // cross-origin — leave address bar as typed
    }
    setIsLoading(false);
    if (turboMode) {
      setRevealPct(100);
    } else {
      beginReveal();
    }
  }, [turboMode, beginReveal]);

  const canBack = historyIdx > 0;
  const canForward = historyIdx < history.length - 1;
  const canStop = isLoading || isRevealing;

  const browserMenus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "Navigate",
      items: [
        { label: "Back",    onClick: handleBack,    disabled: !canBack    },
        { label: "Forward", onClick: handleForward, disabled: !canForward },
        { label: "Stop",    onClick: handleStop,    disabled: !canStop    },
        { label: "Refresh", onClick: handleRefresh, disabled: isHome      },
        { separator: true },
        { label: "Home",    onClick: () => navigateTo(HOME_URL) },
      ],
    },
    {
      label: "Tools",
      items: [
        { label: "Turbo Mode", onClick: () => setTurboMode((t) => !t), checked: turboMode },
      ],
    },
  ], [handleBack, handleForward, handleStop, handleRefresh, canBack, canForward, canStop, isHome, navigateTo, turboMode]);

  useWindowMenus(browserMenus);

  let statusText = "Done";
  if (isLoading) {
    statusText = `Connecting to ${getHostname(currentUrl)}…`;
  } else if (isRevealing) {
    statusText = `Receiving data… ${fakeKbReceived.toFixed(1)} KB of ${fakeKbTotal.toFixed(1)} KB @ 28.8 Kbps`;
  }

  return (
    <div className="ns-internet">

      <div className="ns-internet__toolbar">
        <span className="ns-internet__address-label">Address:</span>
        <input
          className="ns-internet__address-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleGo(); }}
          onFocus={(e) => e.currentTarget.select()}
          spellCheck={false}
          autoComplete="off"
        />
        <button className="ns-internet__go" onClick={handleGo}>Go</button>
      </div>

      {isHome ? (
        <div className="ns-internet__content">
          {/* ── Home page ── */}
          <div className="ns-internet__hp-header">
            <span className="ns-internet__hp-logo">🌐</span>
            <div>
              <div className="ns-internet__hp-title">Noahsoft Exploder 4.0</div>
              <div className="ns-internet__hp-subtitle">Start Page</div>
            </div>
          </div>

          <div className="ns-internet__hp-body">
            <section className="ns-internet__hp-section">
              <h2 className="ns-internet__hp-heading">Getting Started</h2>
              <p className="ns-internet__hp-p">
                Type a web address in the <strong>Address</strong> bar and press <strong>Enter</strong> or click <strong>Go</strong>.
              </p>
              <p className="ns-internet__hp-p">
                Pages load at <strong>56K modem speed</strong> by default — just like the good old days.
                For instant loading, open the <strong>Tools</strong> menu and select <strong>Turbo Mode</strong>.
              </p>
              <p className="ns-internet__hp-p ns-internet__hp-note">
                ⚠ Some sites cannot load due to security restrictions (X-Frame-Options).
              </p>
            </section>

            <hr className="ns-internet__hp-hr" />

            <section className="ns-internet__hp-section">
              <h2 className="ns-internet__hp-heading">Favorites</h2>
              <ul className="ns-internet__hp-favs">
                {FAVORITES.map((fav) => (
                  <li key={fav.url} className="ns-internet__hp-fav">
                    <button
                      className="ns-internet__hp-link"
                      onClick={() => navigateTo(fav.url)}
                    >
                      {fav.display}
                    </button>
                    <span className="ns-internet__hp-fav-desc">{fav.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : (
        <div className="ns-internet__iframe-wrap">
          {isLoading && (
            <div className="ns-internet__loading-bar">
              <div className="ns-internet__loading-bar-fill" />
            </div>
          )}
          <iframe
            key={frameKey}
            ref={iframeRef}
            src={currentUrl}
            className="ns-internet__iframe"
            onLoad={handleIframeLoad}
            title="Noahsoft Exploder"
          />
          {revealPct < 100 && (
            <div
              className="ns-internet__cover"
              style={{ height: `${100 - revealPct}%` }}
            />
          )}
        </div>
      )}

      <div className="ns-internet__statusbar">
        {statusText} &nbsp;|&nbsp; Noahsoft Exploder 4.0
      </div>
    </div>
  );
}
