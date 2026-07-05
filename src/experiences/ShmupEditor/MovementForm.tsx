import {
  defaultSpiral,
  defaultStraightLine,
  defaultTeleport,
  defaultWave,
  type MovementBehavior,
  type Waveform,
} from "./encounterTypes";

interface MovementFormProps {
  movement: MovementBehavior;
  onChange: (movement: MovementBehavior) => void;
  /** Bullets use only the 3 primitives that don't need entrance/exit concepts (spec §7) — teleport is edge-only. */
  allowTeleport?: boolean;
}

const WAVEFORMS: Waveform[] = ["smooth", "triangle", "square"];

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="shmup-field shmup-field--inline">
      <span>{label}</span>
      <input type="number" step={step} className="shmup-input shmup-input--small" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** Kind-switch + param form for the 4 movement primitives (specs/games/shmup/enemies-and-bullets.spec.todo.md §2). Used on graph edges and (minus teleport) on bullets. */
export default function MovementForm({ movement, onChange, allowTeleport = true }: MovementFormProps) {
  return (
    <div className="shmup-movement-form">
      <div className="shmup-btn-row">
        <button type="button" className={`shmup-btn shmup-btn--small ${movement.kind === "straightLine" ? "shmup-btn--active" : ""}`} onClick={() => onChange(defaultStraightLine())}>
          Straight Line
        </button>
        <button type="button" className={`shmup-btn shmup-btn--small ${movement.kind === "wave" ? "shmup-btn--active" : ""}`} onClick={() => onChange(defaultWave())}>
          Wave
        </button>
        <button type="button" className={`shmup-btn shmup-btn--small ${movement.kind === "spiral" ? "shmup-btn--active" : ""}`} onClick={() => onChange(defaultSpiral())}>
          Spiral
        </button>
        {allowTeleport && (
          <button type="button" className={`shmup-btn shmup-btn--small ${movement.kind === "teleport" ? "shmup-btn--active" : ""}`} onClick={() => onChange(defaultTeleport())}>
            Teleport
          </button>
        )}
      </div>

      {movement.kind === "straightLine" && (
        <>
          <div className="shmup-field-row">
            <NumberField label="Speed" value={movement.speed} onChange={(speed) => onChange({ ...movement, speed })} />
            <NumberField label="Accel" value={movement.accel} onChange={(accel) => onChange({ ...movement, accel })} />
            <NumberField label="Turn rate" value={movement.turnRate} onChange={(turnRate) => onChange({ ...movement, turnRate })} />
          </div>
          <p className="shmup-hint">Turn rate: 0 = straight; nonzero turns continuously toward the player (this IS homing, not a separate movement type).</p>
        </>
      )}

      {movement.kind === "wave" && (
        <>
          <div className="shmup-field-row">
            <NumberField label="Speed" value={movement.speed} onChange={(speed) => onChange({ ...movement, speed })} />
            <NumberField label="Amplitude" value={movement.amplitude} onChange={(amplitude) => onChange({ ...movement, amplitude })} />
            <NumberField label="Frequency" value={movement.frequency} step={0.1} onChange={(frequency) => onChange({ ...movement, frequency })} />
            <NumberField label="Phase" value={movement.phase} step={0.1} onChange={(phase) => onChange({ ...movement, phase })} />
          </div>
          <label className="shmup-field shmup-field--inline">
            <span>Waveform</span>
            <select className="shmup-input" value={movement.waveform} onChange={(e) => onChange({ ...movement, waveform: e.target.value as Waveform })}>
              {WAVEFORMS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {movement.kind === "spiral" && (
        <div className="shmup-field-row">
          <NumberField label="Speed" value={movement.speed} onChange={(speed) => onChange({ ...movement, speed })} />
          <NumberField label="Radius" value={movement.radius} onChange={(radius) => onChange({ ...movement, radius })} />
          <NumberField label="Angular speed" value={movement.angularSpeed} onChange={(angularSpeed) => onChange({ ...movement, angularSpeed })} />
          <NumberField label="Radius growth" value={movement.radiusGrowth} step={0.1} onChange={(radiusGrowth) => onChange({ ...movement, radiusGrowth })} />
        </div>
      )}

      {movement.kind === "teleport" && (
        <div className="shmup-field-row">
          <NumberField label="Delay (sec)" value={movement.delay} step={0.1} onChange={(delay) => onChange({ ...movement, delay })} />
          <label className="shmup-checkbox">
            <input type="checkbox" checked={movement.telegraphAtDestination} onChange={(e) => onChange({ ...movement, telegraphAtDestination: e.target.checked })} />
            Telegraph at destination
          </label>
        </div>
      )}
    </div>
  );
}
