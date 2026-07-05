import { useState } from "react";
import AttackPayloadForm from "./AttackPayloadForm";
import DwellForm from "./DwellForm";
import EntranceForm from "./EntranceForm";
import ExitForm from "./ExitForm";
import { hasOutgoingEdge, updateNode } from "./encounterGraph";
import { defaultEntranceAppearance, type EncounterEnemy, type GraphNode } from "./encounterTypes";

interface NodePanelProps {
  instance: EncounterEnemy;
  node: GraphNode;
  onChange: (instance: EncounterEnemy) => void;
}

type Tab = "dwell" | "attack" | "exit" | "entrance";

/** Below-canvas settings panel for a selected node — tabs only for what's actually eligible on this node (Exit only on a leaf, Entrance only on the entrance node). */
export default function NodePanel({ instance, node, onChange }: NodePanelProps) {
  const isEntrance = instance.entranceNodeId === node.id;
  const isLeaf = !hasOutgoingEdge(instance, node.id);
  const [tab, setTab] = useState<Tab>("dwell");

  const tabs: { id: Tab; label: string }[] = [
    { id: "dwell", label: "Dwell" },
    { id: "attack", label: "Attack" },
    ...(isLeaf ? [{ id: "exit" as const, label: "Exit" }] : []),
    ...(isEntrance ? [{ id: "entrance" as const, label: "Entrance" }] : []),
  ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  function patch(fields: Partial<GraphNode>) {
    onChange(updateNode(instance, node.id, fields));
  }

  return (
    <div className="shmup-panel">
      <div className="shmup-btn-row">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={`shmup-btn shmup-btn--small ${activeTab === t.id ? "shmup-btn--active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "dwell" && <DwellForm dwell={node.dwell} onChange={(dwell) => patch({ dwell })} />}
      {activeTab === "attack" && <AttackPayloadForm payload={node.attack} onChange={(attack) => patch({ attack })} label="Attack enabled on this node" />}
      {activeTab === "exit" && isLeaf && <ExitForm exit={node.exit} onChange={(exit) => patch({ exit })} />}
      {activeTab === "entrance" && isEntrance && (
        <EntranceForm appearance={node.entranceAppearance ?? defaultEntranceAppearance()} onChange={(entranceAppearance) => patch({ entranceAppearance })} />
      )}
    </div>
  );
}
