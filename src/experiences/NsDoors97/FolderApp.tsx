import { useState } from "react";
import { experiences, type Experience } from "../../data/experiences";
import "./FolderApp.css";

type Category = Experience["category"];

const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  screensaver: { label: "Screensavers", icon: "📺" },
  game:        { label: "Games",        icon: "🎮" },
  toy:         { label: "Toys",         icon: "🧸" },
  educational: { label: "Educational",  icon: "📚" },
};

const EXPERIENCE_ICONS: Record<string, string> = {
  starfield:        "⭐",
  fireworks:        "🎆",
  "bouncing-shapes": "🔷",
  "typing-racer":   "⌨️",
  "number-muncher": "🔢",
  "tic-tac-toe":    "✖️",
  "word-whirlwind": "🌪️",
};

// Derive unique categories in display order
const CATEGORIES = (
  ["game", "educational", "toy", "screensaver"] as Category[]
).filter((cat) => experiences.some((e) => e.category === cat && e.id !== "ns-doors-97"));

interface FolderItemProps {
  icon: string;
  label: string;
  onOpen: () => void;
}

function FolderItem({ icon, label, onOpen }: FolderItemProps) {
  const [selected, setSelected] = useState(false);
  const lastClick = { current: 0 };

  function handleClick() {
    const now = Date.now();
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    if (isTouchDevice || now - lastClick.current < 400) {
      onOpen();
      setSelected(false);
    } else {
      setSelected(true);
    }
    lastClick.current = now;
  }

  return (
    <button
      className={`ns-folder-item${selected ? " ns-folder-item--selected" : ""}`}
      onClick={handleClick}
      onBlur={() => setSelected(false)}
      aria-label={`Open ${label}`}
    >
      <span className="ns-folder-item__icon">{icon}</span>
      <span className="ns-folder-item__label">{label}</span>
    </button>
  );
}

interface FolderAppProps {
  onOpenExperience: (id: string) => void;
}

export default function FolderApp({ onOpenExperience }: FolderAppProps) {
  const [currentCat, setCurrentCat] = useState<Category | null>(null);

  const toysInCategory = currentCat
    ? experiences.filter(
        (e) => e.category === currentCat && e.id !== "ns-doors-97"
      )
    : [];

  const addressPath = currentCat
    ? `C:\\MyDoors\\${CATEGORY_META[currentCat].label}`
    : "C:\\MyDoors";

  return (
    <div className="ns-folder">
      {/* ── Address bar ── */}
      <div className="ns-folder__toolbar">
        {currentCat && (
          <button
            className="ns-folder__back-btn"
            onClick={() => setCurrentCat(null)}
            title="Up one level"
          >
            ← Up
          </button>
        )}
        <div className="ns-folder__address ns-sunken">{addressPath}</div>
      </div>

      {/* ── Content ── */}
      <div className="ns-folder__content">
        {currentCat === null
          ? CATEGORIES.map((cat) => (
              <FolderItem
                key={cat}
                icon={CATEGORY_META[cat].icon}
                label={CATEGORY_META[cat].label}
                onOpen={() => setCurrentCat(cat)}
              />
            ))
          : toysInCategory.map((exp) => (
              <FolderItem
                key={exp.id}
                icon={EXPERIENCE_ICONS[exp.id] ?? "🖥️"}
                label={exp.title}
                onOpen={() => onOpenExperience(exp.id)}
              />
            ))}
      </div>

      {/* ── Status bar ── */}
      <div className="ns-folder__statusbar ns-sunken">
        {currentCat === null
          ? `${CATEGORIES.length} folder${CATEGORIES.length !== 1 ? "s" : ""}`
          : `${toysInCategory.length} object${toysInCategory.length !== 1 ? "s" : ""}`}
      </div>
    </div>
  );
}
