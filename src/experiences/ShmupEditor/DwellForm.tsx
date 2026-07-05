import { defaultOrbitDwell, defaultWaitDwell, type DwellBehavior } from "./encounterTypes";

interface DwellFormProps {
  dwell: DwellBehavior | null;
  onChange: (dwell: DwellBehavior | null) => void;
}

/** Kind-switch + param form for the 2 node dwell behaviors (specs/games/shmup/enemies-and-bullets.spec.todo.md §3) — what a node does while occupying it, as opposed to moving between nodes. */
export default function DwellForm({ dwell, onChange }: DwellFormProps) {
  return (
    <div className="shmup-dwell-form">
      <div className="shmup-btn-row">
        <button type="button" className={`shmup-btn shmup-btn--small ${dwell === null ? "shmup-btn--active" : ""}`} onClick={() => onChange(null)}>
          None
        </button>
        <button type="button" className={`shmup-btn shmup-btn--small ${dwell?.kind === "wait" ? "shmup-btn--active" : ""}`} onClick={() => onChange(defaultWaitDwell())}>
          Wait
        </button>
        <button type="button" className={`shmup-btn shmup-btn--small ${dwell?.kind === "orbit" ? "shmup-btn--active" : ""}`} onClick={() => onChange(defaultOrbitDwell())}>
          Orbit
        </button>
      </div>

      {dwell?.kind === "wait" && (
        <label className="shmup-checkbox">
          <input type="checkbox" checked={dwell.scrollLocked} onChange={(e) => onChange({ ...dwell, scrollLocked: e.target.checked })} />
          Scroll-locked (drifts with terrain, vs. holding screen position)
        </label>
      )}

      {dwell?.kind === "orbit" && (
        <>
          <div className="shmup-field-row">
            <label className="shmup-field shmup-field--inline">
              <span>Radius</span>
              <input type="number" className="shmup-input shmup-input--small" value={dwell.radius} onChange={(e) => onChange({ ...dwell, radius: Number(e.target.value) })} />
            </label>
            <label className="shmup-field shmup-field--inline">
              <span>Angular speed</span>
              <input type="number" className="shmup-input shmup-input--small" value={dwell.angularSpeed} onChange={(e) => onChange({ ...dwell, angularSpeed: Number(e.target.value) })} />
            </label>
          </div>
          <label className="shmup-checkbox">
            <input type="checkbox" checked={dwell.scrollLocked} onChange={(e) => onChange({ ...dwell, scrollLocked: e.target.checked })} />
            Scroll-locked (drifts with terrain, vs. holding screen position)
          </label>
        </>
      )}
    </div>
  );
}
