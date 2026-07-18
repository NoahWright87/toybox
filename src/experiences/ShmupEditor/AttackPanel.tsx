import { Dial } from "../../components/Dial/Dial";
import type { EncounterAttack } from "./encounterTypes";
import type { UnitDef } from "./unitTypes";

interface AttackPanelProps {
  unit: UnitDef | undefined;
  attack: EncounterAttack;
  onChange: (patch: Partial<EncounterAttack>) => void;
}

/**
 * Below-canvas settings for a selected attack-track placement, rendered
 * inside the Attack tab (EncounterEditor.tsx) — mirrors StepPanel.tsx's
 * role for steps. Aim angle override also has a draggable handle on the
 * canvas itself; this field and that handle write the same value. Full
 * behavior notes live in the Help menu, not inline.
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
            <span className="shmup-error">(no Weapons on this Part)</span>
          )
        ) : (
          <span className="shmup-error">(missing Part)</span>
        )}
      </label>

      <div className="shmup-dial-grid">
        <Dial label="Time (s)" value={attack.time} onChange={(v) => onChange({ time: Math.max(0, v) })} step={0.1} showNudgeButtons />
        <Dial label="Duration (ms)" value={attack.durationMs} onChange={(v) => onChange({ durationMs: Math.max(0, v) })} step={100} showNudgeButtons />
        {showAimOverride && (
          <div className="shmup-dial-with-clear">
            <Dial label="Aim (deg)" value={attack.aimAngleOverride ?? weapon!.fixedAngleDeg} onChange={(v) => onChange({ aimAngleOverride: v })} step={1} showNudgeButtons />
            {attack.aimAngleOverride !== null && (
              <button type="button" className="shmup-dial-clear-btn" title="Clear override — follow the Weapon's own angle" onClick={() => onChange({ aimAngleOverride: null })}>
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
