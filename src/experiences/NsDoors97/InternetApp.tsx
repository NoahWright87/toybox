import { useState, useRef, useCallback, useMemo } from "react";
import { Card, CardGrid, Text, Pill } from "@noahwright/design";
import { experiences } from "../../data/experiences";
import "./InternetApp.css";

const HOME_URL = "__home__";
const HOME_DISPLAY = "http://www.noahwright.dev/toybox";

interface InternetAppProps {
  onOpenExperience: (id: string) => void;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === HOME_DISPLAY) return HOME_URL;
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return "https://" + trimmed;
  }
  return trimmed;
}

export default function InternetApp({ onOpenExperience }: InternetAppProps) {
  const [inputValue, setInputValue] = useState(HOME_DISPLAY);
  const [history, setHistory] = useState<string[]>([HOME_URL]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentUrl = history[historyIdx];
  const isHome = currentUrl === HOME_URL;

  const visibleExperiences = experiences.filter((e) => e.id !== "ns-doors-97");
  const categories = useMemo(
    () => Array.from(new Set<string>(visibleExperiences.map((e) => e.category))).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const filtered = activeCategory
    ? visibleExperiences.filter((e) => e.category === activeCategory)
    : visibleExperiences;

  const navigateTo = useCallback(
    (url: string) => {
      setHistory((prev) => [...prev.slice(0, historyIdx + 1), url]);
      setHistoryIdx((i) => i + 1);
      setInputValue(url === HOME_URL ? HOME_DISPLAY : url);
      setIsLoading(url !== HOME_URL);
      setFrameKey((k) => k + 1);
    },
    [historyIdx]
  );

  const handleGo = useCallback(() => {
    navigateTo(normalizeUrl(inputValue));
  }, [inputValue, navigateTo]);

  const handleBack = useCallback(() => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    const url = history[newIdx];
    setHistoryIdx(newIdx);
    setInputValue(url === HOME_URL ? HOME_DISPLAY : url);
    setIsLoading(url !== HOME_URL);
    setFrameKey((k) => k + 1);
  }, [history, historyIdx]);

  const handleForward = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const url = history[newIdx];
    setHistoryIdx(newIdx);
    setInputValue(url === HOME_URL ? HOME_DISPLAY : url);
    setIsLoading(url !== HOME_URL);
    setFrameKey((k) => k + 1);
  }, [history, historyIdx]);

  const handleStop = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.stop();
    } catch (_) {
      // cross-origin stop may throw
    }
    setIsLoading(false);
  }, []);

  const handleRefresh = useCallback(() => {
    if (isHome) return;
    setIsLoading(true);
    setFrameKey((k) => k + 1);
  }, [isHome]);

  const canBack = historyIdx > 0;
  const canForward = historyIdx < history.length - 1;

  return (
    <div className="ns-internet">
      {/* ── Browser toolbar ── */}
      <div className="ns-internet__toolbar">
        <div className="ns-internet__nav-btns">
          <button
            className="ns-internet__nav-btn"
            onClick={handleBack}
            disabled={!canBack}
            title="Back"
          >
            ◄
          </button>
          <button
            className="ns-internet__nav-btn"
            onClick={handleForward}
            disabled={!canForward}
            title="Forward"
          >
            ►
          </button>
          <button
            className="ns-internet__nav-btn"
            onClick={handleStop}
            disabled={!isLoading}
            title="Stop"
          >
            ✕
          </button>
          <button
            className="ns-internet__nav-btn"
            onClick={handleRefresh}
            disabled={isHome}
            title="Refresh"
          >
            ⟳
          </button>
        </div>
        <div className="ns-internet__address-wrap">
          <span className="ns-internet__address-label">Address:</span>
          <input
            className="ns-internet__address-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleGo();
            }}
            onFocus={(e) => e.currentTarget.select()}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <button className="ns-internet__go" onClick={handleGo}>
          Go
        </button>
      </div>

      {/* ── Page content ── */}
      {isHome ? (
        <div className="ns-internet__content">
          <div className="ns-internet__page">
            <h1 className="ns-internet__page-title">🧸 Toy Box</h1>
            <p className="ns-internet__page-sub">
              Tiny browser-based games, toys, and experiments. Pick one and play.
            </p>
            <div className="ns-internet__filters">
              <button
                className={`ns-internet__filter${activeCategory === null ? " ns-internet__filter--active" : ""}`}
                onClick={() => setActiveCategory(null)}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`ns-internet__filter${activeCategory === cat ? " ns-internet__filter--active" : ""}`}
                  onClick={() =>
                    setActiveCategory(cat === activeCategory ? null : cat)
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
            <CardGrid minCardWidth="220px" gap="md">
              {filtered.map((exp) => (
                <Card
                  key={exp.id}
                  title={exp.title}
                  subtitle={
                    <Pill variant="primary" size="small">
                      {exp.category}
                    </Pill>
                  }
                  interactive
                  elevated
                  onClick={() => onOpenExperience(exp.id)}
                >
                  <Text tone="muted">{exp.description}</Text>
                </Card>
              ))}
            </CardGrid>
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
            onLoad={() => setIsLoading(false)}
            title="Noahsoft Exploder"
          />
        </div>
      )}

      {/* ── Status bar ── */}
      <div className="ns-internet__statusbar ns-internet__sunken">
        {isLoading ? `Loading ${currentUrl}…` : "Done"} &nbsp;|&nbsp; Noahsoft Exploder 4.0
      </div>
    </div>
  );
}
