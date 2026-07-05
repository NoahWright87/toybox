import type { ExitConfig, ExitType } from "./encounterTypes";

interface ExitFormProps {
  exit: ExitConfig | null;
  onChange: (exit: ExitConfig | null) => void;
}

const EXIT_TYPES: { type: ExitType; label: string }[] = [
  { type: "leave", label: "Leave" },
  { type: "vanish", label: "Vanish" },
  { type: "ram", label: "Ram" },
];

/** Exit type/params for a terminal (leaf) node (specs/games/shmup/enemies-and-bullets.spec.todo.md §4). */
export default function ExitForm({ exit, onChange }: ExitFormProps) {
  return (
    <div className="shmup-exit-form">
      <div className="shmup-btn-row">
        <button type="button" className={`shmup-btn shmup-btn--small ${exit === null ? "shmup-btn--active" : ""}`} onClick={() => onChange(null)}>
          None (scrolls off with tile)
        </button>
        {EXIT_TYPES.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            className={`shmup-btn shmup-btn--small ${exit?.type === type ? "shmup-btn--active" : ""}`}
            onClick={() => onChange({ type, direction: exit?.direction ?? 90 })}
          >
            {label}
          </button>
        ))}
      </div>
      {exit?.type === "leave" && (
        <label className="shmup-field shmup-field--inline">
          <span>Direction (deg, 0 = right, 90 = down)</span>
          <input type="number" className="shmup-input shmup-input--small" value={exit.direction} onChange={(e) => onChange({ ...exit, direction: Number(e.target.value) })} />
        </label>
      )}
      {exit?.type === "ram" && <p className="shmup-hint">Homes toward the player and continues through/off-screen if it misses. Pair with an onDeath attack for a suicide bomber.</p>}
    </div>
  );
}
