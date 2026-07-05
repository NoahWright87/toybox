import type { BranchCondition, BranchTrigger } from "./enemyTypes";

export interface BranchNodeOption {
  id: string;
  label: string;
}

interface BranchFormProps {
  branch: BranchCondition | null;
  nodeOptions: BranchNodeOption[];
  onChange: (branch: BranchCondition | null) => void;
}

/** HP/time-threshold jump to another node — generalizes flee/enrage/phase-change/boss-bail-out (specs/games/shmup/enemies-and-bullets.spec.todo.md §5). Usable on any node or edge. */
export default function BranchForm({ branch, nodeOptions, onChange }: BranchFormProps) {
  return (
    <div className="shmup-branch-form">
      <label className="shmup-checkbox">
        <input
          type="checkbox"
          checked={branch !== null}
          onChange={(e) => onChange(e.target.checked ? { trigger: "hp", threshold: 0.25, targetNodeId: nodeOptions[0]?.id ?? "" } : null)}
        />
        Branch condition enabled
      </label>

      {branch && (
        <div className="shmup-field-row">
          <label className="shmup-field shmup-field--inline">
            <span>Trigger</span>
            <select className="shmup-input" value={branch.trigger} onChange={(e) => onChange({ ...branch, trigger: e.target.value as BranchTrigger })}>
              <option value="hp">HP falls to/below</option>
              <option value="time">Elapsed time reaches</option>
            </select>
          </label>
          <label className="shmup-field shmup-field--inline">
            <span>{branch.trigger === "hp" ? "Fraction of max HP (0-1)" : "Seconds"}</span>
            <input
              type="number"
              step={branch.trigger === "hp" ? 0.05 : 1}
              className="shmup-input shmup-input--small"
              value={branch.threshold}
              onChange={(e) => onChange({ ...branch, threshold: Number(e.target.value) })}
            />
          </label>
          <label className="shmup-field shmup-field--inline">
            <span>Jump to</span>
            <select className="shmup-input" value={branch.targetNodeId} onChange={(e) => onChange({ ...branch, targetNodeId: e.target.value })}>
              {nodeOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
