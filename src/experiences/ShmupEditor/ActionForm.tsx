import { useState } from "react";
import { Dial } from "../../components/Dial/Dial";
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

type ActionTab = "basics" | "state" | "attack";

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
 * **Tabbed (Basics/State/Attack) with `Dial` knobs**, mirroring
 * `EncounterEditor.tsx`'s tab treatment and `StepPanel.tsx`/
 * `AttackPanel.tsx`'s Dial conversion — this form used to be one long
 * scrolling stack of fields with muted `.shmup-hint` paragraphs; explanatory
 * text now lives in the Help menu (`ShmupEditor.tsx`'s "Units & Actions"
 * topic) instead. The live `ActionPreview` stays outside the tabs,
 * deliberately the first thing shown regardless of which tab is active — a
 * shmup's whole appeal is the bullet pattern actually reading well, which a
 * wall of number fields alone can't communicate (Noah's request).
 */
export default function ActionForm({ action, onChange, units, excludeUnitId }: ActionFormProps) {
  const [tab, setTab] = useState<ActionTab>("basics");
  const spawnCandidates = units.filter((u) => u.id !== excludeUnitId);
  const attack = action.attack;

  function updateAttack(patch: Partial<NonNullable<ActionDef["attack"]>>) {
    if (!attack) return;
    onChange({ ...action, attack: { ...attack, ...patch } });
  }

  return (
    <div className="shmup-weapon-form">
      <ActionPreview action={action} units={units} />

      <div className="shmup-enc-tabs">
        <div className="shmup-enc-tabbar">
          <button type="button" className={`shmup-enc-tab-btn ${tab === "basics" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setTab("basics")}>
            Basics
          </button>
          <button type="button" className={`shmup-enc-tab-btn ${tab === "state" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setTab("state")}>
            State
          </button>
          <button type="button" className={`shmup-enc-tab-btn ${tab === "attack" ? "shmup-enc-tab-btn--active" : ""}`} onClick={() => setTab("attack")}>
            Attack{attack ? "" : " (none)"}
          </button>
        </div>

        <div className="shmup-enc-tab-content">
          {tab === "basics" && (
            <div className="shmup-panel">
              <label className="shmup-field shmup-field--inline">
                <span>Name</span>
                <input type="text" className="shmup-input" value={action.name} onChange={(e) => onChange({ ...action, name: e.target.value })} />
              </label>

              <label className="shmup-field shmup-field--inline">
                <span>Facing</span>
                <select className="shmup-input" value={action.facing} onChange={(e) => onChange({ ...action, facing: e.target.value as FacingMode })}>
                  <option value="fixed">Fixed direction</option>
                  <option value="faceMovement">Follows movement</option>
                  <option value="facePlayer">Faces the player</option>
                </select>
              </label>

              <div className="shmup-dial-grid">
                <Dial label="Movement %" value={action.movementPercent} onChange={(v) => onChange({ ...action, movementPercent: v })} min={0} max={100} step={5} showNudgeButtons />
                {action.facing === "fixed" && (
                  <Dial label="Angle (deg)" value={action.fixedFacingDeg} onChange={(v) => onChange({ ...action, fixedFacingDeg: v })} step={5} showNudgeButtons />
                )}
              </div>
            </div>
          )}

          {tab === "state" && (
            <div className="shmup-panel">
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
          )}

          {tab === "attack" && (
            <div className="shmup-panel">
              <div className="shmup-field-row">
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
                  <div className="shmup-dial-grid">
                    <Dial label="Arc start" value={attack.arcStartDeg} onChange={(v) => updateAttack({ arcStartDeg: v })} step={5} showNudgeButtons />
                    <Dial label="Arc end" value={attack.arcEndDeg} onChange={(v) => updateAttack({ arcEndDeg: v })} step={5} showNudgeButtons />
                    <Dial label="Shot count" value={attack.count} onChange={(v) => updateAttack({ count: Math.max(1, v) })} min={1} step={1} showNudgeButtons />
                  </div>
                  <label className="shmup-field shmup-field--inline">
                    <span>Spacing</span>
                    <select className="shmup-input" value={attack.spacing} onChange={(e) => updateAttack({ spacing: e.target.value as "even" | "random" })}>
                      <option value="even">Even</option>
                      <option value="random">Random (shotgun)</option>
                    </select>
                  </label>

                  <div className="shmup-dial-grid">
                    <Dial label="Per-shot delay (ms)" value={attack.perShotDelayMs} onChange={(v) => updateAttack({ perShotDelayMs: Math.max(0, v) })} min={0} step={10} showNudgeButtons />
                    <Dial label="Sweep speed (deg/s)" value={attack.sweepSpeedDeg} onChange={(v) => updateAttack({ sweepSpeedDeg: v })} step={5} showNudgeButtons />
                  </div>
                  {attack.sweepSpeedDeg !== 0 && (
                    <label className="shmup-checkbox">
                      <input type="checkbox" checked={attack.pingPong} onChange={(e) => updateAttack({ pingPong: e.target.checked })} />
                      Ping-pong (oscillate instead of spinning continuously)
                    </label>
                  )}

                  <div className="shmup-dial-grid">
                    <Dial label="Burst interval (ms)" value={attack.burstIntervalMs} onChange={(v) => updateAttack({ burstIntervalMs: Math.max(0, v) })} min={0} step={50} showNudgeButtons />
                    <Dial label="Telegraph (ms)" value={attack.telegraphMs} onChange={(v) => updateAttack({ telegraphMs: Math.max(0, v) })} min={0} step={50} showNudgeButtons />
                  </div>

                  <div className="shmup-field-row">
                    <label className="shmup-checkbox">
                      <input type="checkbox" checked={attack.repeatCount === null} onChange={(e) => updateAttack({ repeatCount: e.target.checked ? null : 1 })} />
                      Fire for as long as this Action runs
                    </label>
                    {attack.repeatCount !== null && (
                      <div className="shmup-dial-grid">
                        <Dial label="Burst count" value={attack.repeatCount} onChange={(v) => updateAttack({ repeatCount: Math.max(1, v) })} min={1} step={1} showNudgeButtons />
                      </div>
                    )}
                  </div>

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
                    <span>Collision group</span>
                    <select className="shmup-input" value={attack.spawnGroup} onChange={(e) => updateAttack({ spawnGroup: e.target.value as CollisionGroup })}>
                      {(Object.keys(COLLISION_GROUP_LABELS) as CollisionGroup[]).map((group) => (
                        <option key={group} value={group}>
                          {COLLISION_GROUP_LABELS[group]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="shmup-dial-grid">
                    <Dial label="Scale" value={attack.spawnScale} onChange={(v) => updateAttack({ spawnScale: Math.max(0, v) })} min={0} step={0.1} showNudgeButtons />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
