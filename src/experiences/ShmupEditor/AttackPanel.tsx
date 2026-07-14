import type { EncounterAttack } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

interface AttackPanelProps {
  unit: UnitDef | undefined;
  attack: EncounterAttack;
  onChange: (patch: Partial<EncounterAttack>) => void;
}

/**
 * Below-canvas settings for a selected attack-track placement (mirrors
 * StepPanel.tsx's role for steps) — which Part/Weapon fires, when, for how
 * long, and (for a fixed-aim weapon) its angle override, which also has a
 * draggable handle on the canvas itself (EncounterEditor.tsx) — this field
 * and that handle write the same value, same pairing as a step's Speed
 * Multiplier field and the timeline's retime-drag.
 */
export default function AttackPanel({ unit, attack, onChange }: AttackPanelProps) {
  const part = unit?.parts.find((p) => p.id === attack.partId);
  const weapon = part?.weapons.find((w) => w.id === attack.weaponId);
  const showAimOverride = weapon?.aimMode === "fixed";

  function handlePartChange(partId: string) {
    const nextPart = unit?.parts.find((p) => p.id === partId);
    const nextWeaponId = nextPart?.weapons[0]?.id ?? "";
    onChange({ partId, weaponId: nextWeaponId });
  }

  return (
    <div className="shmup-panel">
      {unit && unit.parts.length > 1 && (
        <label className="shmup-field shmup-field--inline">
          <span>Part</span>
          <select className="shmup-input" value={attack.partId} onChange={(e) => handlePartChange(e.target.value)}>
            {unit.parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="shmup-field shmup-field--inline">
        <span>Weapon</span>
        {part ? (
          part.weapons.length > 0 ? (
            <select className="shmup-input" value={attack.weaponId} onChange={(e) => onChange({ weaponId: e.target.value })}>
              {part.weapons.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="shmup-error">(this Part has no Weapons yet)</span>
          )
        ) : (
          <span className="shmup-error">(missing Part)</span>
        )}
      </label>

      <div className="shmup-field-row">
        <label className="shmup-field shmup-field--inline">
          <span>Time (sec)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            className="shmup-input shmup-input--small"
            value={Number(attack.time.toFixed(2))}
            onChange={(e) => onChange({ time: Number(e.target.value) })}
          />
        </label>
        <label className="shmup-field shmup-field--inline">
          <span>Duration (ms)</span>
          <input
            type="number"
            min={0}
            className="shmup-input shmup-input--small"
            value={attack.durationMs}
            onChange={(e) => onChange({ durationMs: Number(e.target.value) })}
          />
        </label>
      </div>
      <p className="shmup-hint">Duration keeps a repeating weapon (nonzero fire interval) firing after the placement's start time; 0 = a single burst.</p>

      {showAimOverride && (
        <label className="shmup-field shmup-field--inline">
          <span>Aim angle override (deg)</span>
          <input
            type="number"
            className="shmup-input shmup-input--small"
            placeholder={String(weapon!.fixedAngleDeg)}
            value={attack.aimAngleOverride ?? ""}
            onChange={(e) => onChange({ aimAngleOverride: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>
      )}
    </div>
  );
}
