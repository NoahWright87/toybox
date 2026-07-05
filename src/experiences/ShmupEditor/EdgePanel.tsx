import { useState } from "react";
import AttackPayloadForm from "./AttackPayloadForm";
import MovementForm from "./MovementForm";
import { updateEdge } from "./encounterGraph";
import type { EncounterEnemy, GraphEdge } from "./encounterTypes";

interface EdgePanelProps {
  instance: EncounterEnemy;
  edge: GraphEdge;
  onChange: (instance: EncounterEnemy) => void;
}

type Tab = "movement" | "attack";
const TABS: { id: Tab; label: string }[] = [
  { id: "movement", label: "Movement" },
  { id: "attack", label: "Attack" },
];

/** Below-canvas settings panel for a selected edge (the movement segment between two nodes). */
export default function EdgePanel({ instance, edge, onChange }: EdgePanelProps) {
  const [tab, setTab] = useState<Tab>("movement");

  function patch(fields: Partial<GraphEdge>) {
    onChange(updateEdge(instance, edge.id, fields));
  }

  return (
    <div className="shmup-panel">
      <div className="shmup-btn-row">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`shmup-btn shmup-btn--small ${tab === t.id ? "shmup-btn--active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "movement" && <MovementForm movement={edge.movement} onChange={(movement) => patch({ movement })} />}
      {tab === "attack" && <AttackPayloadForm payload={edge.attack} onChange={(attack) => patch({ attack })} label="Attack enabled on this edge" />}
    </div>
  );
}
