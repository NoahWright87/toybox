import ActionPreview from "./ActionPreview";
import { createBlankAttack, type ActionDef, type CollisionGroup, type FacingMode, type UnitDef } from "./unitTypes";

interface ActionFormProps {
  action: ActionDef;
  onChange: (action: ActionDef) => void;
  /** The Unit library, for the attack's "what does this spawn" picker. */
  units: UnitDef[];
  /** The Unit currently being authored — excluded from the spawn picker so an attack can't reference its own owning Unit as its projectile (an easy infinite-recursion trap). */
  excludeUnitId: string;
}

const COLLISION_GROUP_LABELS: Record<CollisionGroup, string> = {
  enemy: "Enemy",
  friendly: "Friendly",
  enemyProjectile: "Enemy Projectile",
  friendlyProjectile: "Friendly Projectile",
};

/**
 * Fields for one Action (unitTypes.ts) — movement%/facing/state, plus an
 * optional attack. Replaces the pre-reversal `WeaponForm.tsx`; the attack
 * sub-fields below (arc/count/spacing/sweep/burst/spawn) are the same flat,
 * orthogonal set that form had (per "Design Handoff v2" §5.6 — no
 * shape/aim/trigger matrix), just relocated under `action.attack` now that
 * facing subsumes aim and Weapon is gone as a separate class.
 *
 * The live `ActionPreview` up top is deliberately the first thing shown,
 * not an afterthought at the bottom — a shmup's whole appeal is the bullet
 * pattern actually reading well, which a wall of number fields alone can't
 * communicate (Noah's request).
 */
export default function ActionForm({ action, onChange, units, excludeUnitId }: ActionFormProps) {
  const spawnCandidates = units.filter((u) => u.id !== excludeUnitId);
  const attack = action.attack;

  function updateAttack(patch: Partial<NonNullable<ActionDef["attack"]>>) {
    if (!attack) return;
    onChange({ ...action, attack: { ...attack, ...patch } });
  }

  return (
    <div className="shmup-weapon-form">
      <ActionPreview action={action} units={units} />

      <label className="shmup-field shmup-field--inline">
        <span>Name</span>
        <input type="text" className="shmup-input" value={action.name} onChange={(e) => onChange({ ...action, name: e.target.value })} />
      </label>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Movement %</span>
          <input
            type="number"
            min={0}
            max={100}
            className="shmup-input shmup-input--small"
            value={action.movementPercent}
            onChange={(e) => onChange({ ...action, movementPercent: Math.min(100, Math.max(0, Number(e.target.value))) })}
          />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Facing</span>
          <select className="shmup-input" value={action.facing} onChange={(e) => onChange({ ...action, facing: e.target.value as FacingMode })}>
            <option value="fixed">Fixed direction</option>
            <option value="faceMovement">Follows movement</option>
            <option value="facePlayer">Faces the player</option>
          </select>
        </label>
        {action.facing === "fixed" && (
          <label className="shmup-field shmup-field--inline">
            <span>Angle (deg)</span>
            <input
              type="number"
              className="shmup-input shmup-input--small"
              value={action.fixedFacingDeg}
              onChange={(e) => onChange({ ...action, fixedFacingDeg: Number(e.target.value) })}
            />
          </label>
        )}
      </div>
      <p className="shmup-hint">0 movement % = stationary. A percent of the owning Unit's fixed max speed, never a raw px/sec value.</p>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Sets invincible</span>
          <select
            className="shmup-input"
            value={action.setsInvincible === null ? "" : String(action.setsInvincible)}
            onChange={(e) => onChange({ ...action, setsInvincible: e.target.value === "" ? null : e.target.value === "true" })}
          >
            <option value="">(no change)</option>
            <option value="true">Invincible</option>
            <option value="false">Vulnerable</option>
          </select>
        </label>
        <label className="shmup-checkbox">
          <input type="checkbox" checked={action.requiresInvincible} onChange={(e) => onChange({ ...action, requiresInvincible: e.target.checked })} />
          Requires invincible to run
        </label>
      </div>

      <div className="shmup-field">
        <div className="shmup-field-row">
          <span>Attack</span>
          {attack ? (
            <button type="button" className="shmup-btn shmup-btn--small" onClick={() => onChange({ ...action, attack: null })}>
              Remove Attack
            </button>
          ) : (
            <button type="button" className="shmup-btn shmup-btn--small" onClick={() => onChange({ ...action, attack: createBlankAttack() })}>
              + Add Attack
            </button>
          )}
        </div>

        {attack && (
          <>
            <div className="shmup-field-row">
              <label className="shmup-field shmup-field--inline">
                <span>Arc start (deg)</span>
                <input type="number" className="shmup-input shmup-input--small" value={attack.arcStartDeg} onChange={(e) => updateAttack({ arcStartDeg: Number(e.target.value) })} />
              </label>
              <label className="shmup-field shmup-field--inline">
                <span>Arc end (deg)</span>
                <input type="number" className="shmup-input shmup-input--small" value={attack.arcEndDeg} onChange={(e) => updateAttack({ arcEndDeg: Number(e.target.value) })} />
              </label>
            </div>
            <p className="shmup-hint">
              Relative to this Action's facing. 0/0 = a single shot straight ahead. A narrow range with a few shots is a fan; 0/360 is a full
              radial burst; a range like 5/355 leaves a deliberate gap at the facing direction (a safe lane).
            </p>

            <div className="shmup-field-row">
              <label className="shmup-field shmup-field--inline">
                <span>Shot count</span>
                <input type="number" min={1} className="shmup-input shmup-input--small" value={attack.count} onChange={(e) => updateAttack({ count: Number(e.target.value) })} />
              </label>
              <label className="shmup-field shmup-field--inline">
                <span>Spacing</span>
                <select className="shmup-input" value={attack.spacing} onChange={(e) => updateAttack({ spacing: e.target.value as "even" | "random" })}>
                  <option value="even">Even</option>
                  <option value="random">Random (shotgun)</option>
                </select>
              </label>
              <label className="shmup-field shmup-field--inline">
                <span>Per-shot delay (ms)</span>
                <input type="number" min={0} className="shmup-input shmup-input--small" value={attack.perShotDelayMs} onChange={(e) => updateAttack({ perShotDelayMs: Number(e.target.value) })} />
              </label>
            </div>

            <div className="shmup-field-row">
              <label className="shmup-field shmup-field--inline">
                <span>Sweep speed (deg/sec)</span>
                <input type="number" className="shmup-input shmup-input--small" value={attack.sweepSpeedDeg} onChange={(e) => updateAttack({ sweepSpeedDeg: Number(e.target.value) })} />
              </label>
              {attack.sweepSpeedDeg !== 0 && (
                <label className="shmup-checkbox">
                  <input type="checkbox" checked={attack.pingPong} onChange={(e) => updateAttack({ pingPong: e.target.checked })} />
                  Ping-pong (oscillate instead of spinning continuously)
                </label>
              )}
            </div>
            <p className="shmup-hint">0 = a static arc. Nonzero sweeps the whole arc range over time — this is "rotating"/spiral fire.</p>

            <div className="shmup-field-row">
              <label className="shmup-field shmup-field--inline">
                <span>Burst interval (ms)</span>
                <input type="number" min={0} className="shmup-input shmup-input--small" value={attack.burstIntervalMs} onChange={(e) => updateAttack({ burstIntervalMs: Number(e.target.value) })} />
              </label>
              <label className="shmup-field shmup-field--inline">
                <span>Telegraph (ms)</span>
                <input type="number" min={0} className="shmup-input shmup-input--small" value={attack.telegraphMs} onChange={(e) => updateAttack({ telegraphMs: Number(e.target.value) })} />
              </label>
            </div>

            <div className="shmup-field-row">
              <label className="shmup-checkbox">
                <input type="checkbox" checked={attack.repeatCount === null} onChange={(e) => updateAttack({ repeatCount: e.target.checked ? null : 1 })} />
                Fire for as long as this Action runs
              </label>
              {attack.repeatCount !== null && (
                <label className="shmup-field shmup-field--inline">
                  <span>Burst count</span>
                  <input
                    type="number"
                    min={1}
                    className="shmup-input shmup-input--small"
                    value={attack.repeatCount}
                    onChange={(e) => updateAttack({ repeatCount: Math.max(1, Number(e.target.value)) })}
                  />
                </label>
              )}
            </div>
            <p className="shmup-hint">
              Telegraph is wind-up shown as a distinct color on the timeline before firing. This Action's own duration is derived from however
              long its bursts take to finish (or its movement, whichever is longer) — it isn't hand-edited.
            </p>

            <div className="shmup-field-row">
              <label className="shmup-field shmup-field--inline">
                <span>Spawns</span>
                <select className="shmup-input" value={attack.spawnUnitId ?? ""} onChange={(e) => updateAttack({ spawnUnitId: e.target.value === "" ? null : e.target.value })}>
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
                <input type="number" min={0} step={0.1} className="shmup-input shmup-input--small" value={attack.spawnScale} onChange={(e) => updateAttack({ spawnScale: Number(e.target.value) })} />
              </label>
              <label className="shmup-field shmup-field--inline">
                <span>Collision group</span>
                <select className="shmup-input" value={attack.spawnGroup} onChange={(e) => updateAttack({ spawnGroup: e.target.value as CollisionGroup })}>
                  {(Object.keys(COLLISION_GROUP_LABELS) as CollisionGroup[]).map((group) => (
                    <option key={group} value={group}>
                      {COLLISION_GROUP_LABELS[group]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="shmup-hint">
              Any Unit in the library — including one with its own Parts/Actions, which is what makes recursive/splitting fire free with no
              special case. Scale is a simple flat size multiplier for now.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
