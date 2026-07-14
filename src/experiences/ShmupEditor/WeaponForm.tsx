import { type UnitDef, type WeaponAimMode, type WeaponDef, type WeaponSpacing } from "./unitTypes";

interface WeaponFormProps {
  weapon: WeaponDef;
  onChange: (weapon: WeaponDef) => void;
  /** The Unit library, for the "what does this weapon spawn" picker. */
  units: UnitDef[];
  /** The Unit currently being authored — excluded from the spawn picker so a weapon can't reference its own owning Unit as its projectile (an easy, easy-to-hit infinite-recursion trap). */
  excludeUnitId: string;
}

/**
 * Fields for one Weapon (unitTypes.ts) — a flat, orthogonal set with no
 * shape/aim/trigger matrix, per "Design Handoff v2" §5.6: an aim, an arc
 * range relative to that aim, shot count/spacing/per-shot delay, an
 * optional sweep (nonzero sweep speed is what "rotating fire" reduces to),
 * a firing interval, and what Unit it spawns. Everything is time-based —
 * there's no trigger kind to pick, since the encounter timeline placement
 * (EncounterEditor.tsx's attack track) already says *when* this fires.
 */
export default function WeaponForm({ weapon, onChange, units, excludeUnitId }: WeaponFormProps) {
  const spawnCandidates = units.filter((u) => u.id !== excludeUnitId);

  return (
    <div className="shmup-weapon-form">
      <label className="shmup-field shmup-field--inline">
        <span>Name</span>
        <input type="text" className="shmup-input" value={weapon.name} onChange={(e) => onChange({ ...weapon, name: e.target.value })} />
      </label>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Aim</span>
          <select className="shmup-input" value={weapon.aimMode} onChange={(e) => onChange({ ...weapon, aimMode: e.target.value as WeaponAimMode })}>
            <option value="player">At the player</option>
            <option value="fixed">Fixed direction</option>
          </select>
        </label>
        {weapon.aimMode === "player" && (
          <label className="shmup-checkbox">
            <input type="checkbox" checked={weapon.trackPlayer} onChange={(e) => onChange({ ...weapon, trackPlayer: e.target.checked })} />
            Track continuously (unchecked = snapshot aim once, at fire time)
          </label>
        )}
        {weapon.aimMode === "fixed" && (
          <label className="shmup-field shmup-field--inline">
            <span>Angle (deg)</span>
            <input type="number" className="shmup-input shmup-input--small" value={weapon.fixedAngleDeg} onChange={(e) => onChange({ ...weapon, fixedAngleDeg: Number(e.target.value) })} />
          </label>
        )}
      </div>
      {weapon.aimMode === "fixed" && (
        <p className="shmup-hint">Overridable per placement with a draggable handle on the encounter canvas.</p>
      )}

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Arc start (deg)</span>
          <input type="number" className="shmup-input shmup-input--small" value={weapon.arcStartDeg} onChange={(e) => onChange({ ...weapon, arcStartDeg: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Arc end (deg)</span>
          <input type="number" className="shmup-input shmup-input--small" value={weapon.arcEndDeg} onChange={(e) => onChange({ ...weapon, arcEndDeg: Number(e.target.value) })} />
        </label>
      </div>
      <p className="shmup-hint">
        Relative to the aim direction. 0/0 = a single shot straight at the aim. A narrow range with a few shots is a fan; 0/360 is a full radial
        burst; a range like 5/355 leaves a deliberate gap at the aim direction (a safe lane).
      </p>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Shot count</span>
          <input type="number" min={1} className="shmup-input shmup-input--small" value={weapon.count} onChange={(e) => onChange({ ...weapon, count: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Spacing</span>
          <select className="shmup-input" value={weapon.spacing} onChange={(e) => onChange({ ...weapon, spacing: e.target.value as WeaponSpacing })}>
            <option value="even">Even</option>
            <option value="random">Random (shotgun)</option>
          </select>
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Per-shot delay (ms)</span>
          <input type="number" min={0} className="shmup-input shmup-input--small" value={weapon.perShotDelayMs} onChange={(e) => onChange({ ...weapon, perShotDelayMs: Number(e.target.value) })} />
        </label>
      </div>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Sweep speed (deg/sec)</span>
          <input type="number" className="shmup-input shmup-input--small" value={weapon.sweepSpeedDeg} onChange={(e) => onChange({ ...weapon, sweepSpeedDeg: Number(e.target.value) })} />
        </label>
        {weapon.sweepSpeedDeg !== 0 && (
          <label className="shmup-checkbox">
            <input type="checkbox" checked={weapon.pingPong} onChange={(e) => onChange({ ...weapon, pingPong: e.target.checked })} />
            Ping-pong (oscillate instead of spinning continuously)
          </label>
        )}
      </div>
      <p className="shmup-hint">0 = a static arc. Nonzero sweeps the whole arc range over time — this is "rotating"/spiral fire.</p>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Fire interval (ms)</span>
          <input type="number" min={0} className="shmup-input shmup-input--small" value={weapon.fireIntervalMs} onChange={(e) => onChange({ ...weapon, fireIntervalMs: Number(e.target.value) })} />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Telegraph (ms)</span>
          <input type="number" min={0} className="shmup-input shmup-input--small" value={weapon.telegraphMs} onChange={(e) => onChange({ ...weapon, telegraphMs: Number(e.target.value) })} />
        </label>
      </div>
      <p className="shmup-hint">
        0 fire interval = a single burst. Nonzero repeats for as long as the placement's Duration allows (see the encounter's attack track).
        Telegraph is wind-up shown as a distinct color on the timeline before firing.
      </p>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Spawns</span>
          <select className="shmup-input" value={weapon.spawnUnitId ?? ""} onChange={(e) => onChange({ ...weapon, spawnUnitId: e.target.value === "" ? null : e.target.value })}>
            <option value="">(none)</option>
            {spawnCandidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Scale</span>
          <input type="number" min={0} step={0.1} className="shmup-input shmup-input--small" value={weapon.spawnScale} onChange={(e) => onChange({ ...weapon, spawnScale: Number(e.target.value) })} />
        </label>
      </div>
      <p className="shmup-hint">
        Any Unit in the library — including one with its own Parts/Weapons, which is what makes recursive/splitting fire free with no special
        case. Scale is a simple flat size multiplier for now.
      </p>
    </div>
  );
}
