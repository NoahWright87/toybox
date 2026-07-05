import type { EntranceAppearance, EntranceStyle } from "./encounterTypes";

interface EntranceFormProps {
  appearance: EntranceAppearance;
  onChange: (appearance: EntranceAppearance) => void;
}

const STYLES: EntranceStyle[] = ["fade", "shrink", "rise"];

/** Spawn-time presentation on the entrance node — not a movement behavior (specs/games/shmup/enemies-and-bullets.spec.todo.md, "Entrance" section). If an appear animation plays, it runs before the entrance node's first outgoing edge begins. */
export default function EntranceForm({ appearance, onChange }: EntranceFormProps) {
  return (
    <div className="shmup-entrance-form">
      <div className="shmup-btn-row">
        <button type="button" className={`shmup-btn shmup-btn--small ${appearance.kind === "none" ? "shmup-btn--active" : ""}`} onClick={() => onChange({ ...appearance, kind: "none" })}>
          None (appears instantly)
        </button>
        <button type="button" className={`shmup-btn shmup-btn--small ${appearance.kind === "appear" ? "shmup-btn--active" : ""}`} onClick={() => onChange({ ...appearance, kind: "appear" })}>
          Appear animation
        </button>
      </div>
      {appearance.kind === "appear" && (
        <div className="shmup-field-row">
          <label className="shmup-field shmup-field--inline">
            <span>Style</span>
            <select className="shmup-input" value={appearance.style} onChange={(e) => onChange({ ...appearance, style: e.target.value as EntranceStyle })}>
              {STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="shmup-field shmup-field--inline">
            <span>Duration (ms)</span>
            <input type="number" className="shmup-input shmup-input--small" value={appearance.durationMs} onChange={(e) => onChange({ ...appearance, durationMs: Number(e.target.value) })} />
          </label>
        </div>
      )}
    </div>
  );
}
