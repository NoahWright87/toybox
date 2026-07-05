import { useState } from "react";
import AttackPayloadForm from "./AttackPayloadForm";
import BranchForm from "./BranchForm";
import MovementForm from "./MovementForm";
import { getNodeOptions, updateEdge } from "./enemyGraph";
import type { EnemyDef, GraphEdge } from "./enemyTypes";

interface EdgePanelProps {
  enemy: EnemyDef;
  edge: GraphEdge;
  onChange: (enemy: EnemyDef) => void;
}

type Tab = "movement" | "attack" | "branch";
const TABS: { id: Tab; label: string }[] = [
  { id: "movement", label: "Movement" },
  { id: "attack", label: "Attack" },
  { id: "branch", label: "Branch" },
];

/** Below-canvas settings panel for a selected edge (the movement segment between two nodes). */
export default function EdgePanel({ enemy, edge, onChange }: EdgePanelProps) {
  const [tab, setTab] = useState<Tab>("movement");

  function patch(fields: Partial<GraphEdge>) {
    onChange(updateEdge(enemy, edge.id, fields));
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
      {tab === "branch" && <BranchForm branch={edge.branch} nodeOptions={getNodeOptions(enemy)} onChange={(branch) => patch({ branch })} />}
    </div>
  );
}
