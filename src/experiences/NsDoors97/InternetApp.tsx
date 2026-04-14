import { useState, useMemo } from "react";
import { Card, CardGrid, Text, Pill } from "@noahwright/design";
import { experiences } from "../../data/experiences";
import { useOsDialog } from "./OsDialog";
import { missingFeatureMessage } from "../../utils/missingFeatureMessage";
import "./InternetApp.css";

const NAV_BTNS = ["◄", "►", "✕", "⟳"];
const ADDRESS = "http://www.noahwright.dev/toybox";

interface InternetAppProps {
  onOpenExperience: (id: string) => void;
}

export default function InternetApp({ onOpenExperience }: InternetAppProps) {
  const { showDialog } = useOsDialog();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const visibleExperiences = experiences.filter((e) => e.id !== "ns-doors-97");

  const categories = useMemo(
    () => Array.from(new Set(visibleExperiences.map((e) => e.category))).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const filtered = activeCategory
    ? visibleExperiences.filter((e) => e.category === activeCategory)
    : visibleExperiences;

  return (
    <div className="ns-internet">
      {/* ── Browser chrome ── */}
      <div className="ns-internet__toolbar">
        <div className="ns-internet__nav-btns">
          {NAV_BTNS.map((btn) => (
            <button
              key={btn}
              className="ns-internet__nav-btn"
              onClick={() => showDialog(missingFeatureMessage())}
              title={btn}
            >
              {btn}
            </button>
          ))}
        </div>
        <div className="ns-internet__address-wrap">
          <span className="ns-internet__address-label">Address:</span>
          <div className="ns-internet__address ns-internet__sunken">
            {ADDRESS}
          </div>
        </div>
        <button
          className="ns-internet__go"
          onClick={() => showDialog(missingFeatureMessage())}
        >
          Go
        </button>
      </div>

      {/* ── Page content (intentionally modern — it's a "website") ── */}
      <div className="ns-internet__content">
        <div className="ns-internet__page">
          <h1 className="ns-internet__page-title">🧸 Toy Box</h1>
          <p className="ns-internet__page-sub">
            Tiny browser-based games, toys, and experiments. Pick one and play.
          </p>

          {/* Category filter */}
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
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Card grid — clicking opens the toy inside NS Doors 97 */}
          <CardGrid minCardWidth="220px" gap="md">
            {filtered.map((exp) => (
              <Card
                key={exp.id}
                title={exp.title}
                subtitle={<Pill variant="primary" size="small">{exp.category}</Pill>}
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

      {/* ── Status bar ── */}
      <div className="ns-internet__statusbar ns-internet__sunken">
        Done &nbsp;|&nbsp; Noahsoft Exploder 4.0
      </div>
    </div>
  );
}
