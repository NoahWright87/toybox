import MovementForm from "./MovementForm";
import SpritePicker from "./SpritePicker";
import { createBlankAttackPayload, createBlankBullet, type AimMode, type AttackPayload, type AttackTrigger, type BulletDef, type PatternShape } from "./encounterTypes";

interface AttackPayloadFormProps {
  payload: AttackPayload | null;
  onChange: (payload: AttackPayload | null) => void;
  /** Heading text, e.g. "Attack" at the top level or "Bullet's attack" one level down. */
  label: string;
  /** How many bullet-payload levels deep this form already is — purely cosmetic (indentation), the recursion itself has no hardcoded limit. */
  depth?: number;
}

const SHAPES: { value: PatternShape; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "arc", label: "Arc / fan" },
  { value: "radialBurst", label: "Radial burst" },
  { value: "beam", label: "Beam" },
];
const AIMS: { value: AimMode; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "aimed", label: "Aimed" },
  { value: "rotating", label: "Rotating" },
];
const TRIGGERS: { value: AttackTrigger; label: string }[] = [
  { value: "continuous", label: "Continuous" },
  { value: "onDeath", label: "On death" },
  { value: "onTrigger", label: "On trigger (telegraphed)" },
  { value: "onProximity", label: "On proximity" },
];

function BulletForm({ bullet, onChange, depth }: { bullet: BulletDef; onChange: (b: BulletDef) => void; depth: number }) {
  return (
    <div className="shmup-bullet-form">
      <SpritePicker spriteId={bullet.spriteId} customSprite={bullet.customSprite} onChange={(spriteId, customSprite) => onChange({ ...bullet, spriteId, customSprite })} />
      <p className="shmup-hint">Bullet movement (no teleport — a bullet's spawn/expire ARE its entrance/exit):</p>
      <MovementForm movement={bullet.movement} allowTeleport={false} onChange={(movement) => onChange({ ...bullet, movement: movement as BulletDef["movement"] })} />
      {/* Free recursion (specs/games/shmup/enemies-and-bullets.spec.todo.md §7): a bullet's own payload can spawn another bullet, whose payload can spawn another, etc. */}
      <AttackPayloadForm payload={bullet.attack} onChange={(attack) => onChange({ ...bullet, attack })} label="This bullet also fires" depth={depth + 1} />
    </div>
  );
}

/**
 * Pattern shape x aim mode x trigger, plus the bullet this payload spawns
 * (specs/games/shmup/enemies-and-bullets.spec.todo.md §6-7). Recurses into
 * itself via BulletForm for nested splitting/homing/curving bullets — the
 * same component renders every nesting level, since a bullet's payload has
 * exactly the same shape as any other attack payload.
 */
export default function AttackPayloadForm({ payload, onChange, label, depth = 0 }: AttackPayloadFormProps) {
  return (
    <div className="shmup-attack-form" style={depth > 0 ? { marginLeft: 14, borderLeft: "2px dashed #808080", paddingLeft: 10 } : undefined}>
      <label className="shmup-checkbox">
        <input type="checkbox" checked={payload !== null} onChange={(e) => onChange(e.target.checked ? createBlankAttackPayload() : null)} />
        {label}
      </label>

      {payload && (
        <>
          <div className="shmup-field-row">
            <label className="shmup-field shmup-field--inline">
              <span>Shape</span>
              <select className="shmup-input" value={payload.shape} onChange={(e) => onChange({ ...payload, shape: e.target.value as PatternShape })}>
                {SHAPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="shmup-field shmup-field--inline">
              <span>Aim</span>
              <select className="shmup-input" value={payload.aim} onChange={(e) => onChange({ ...payload, aim: e.target.value as AimMode })}>
                {AIMS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="shmup-field shmup-field--inline">
              <span>Trigger</span>
              <select className="shmup-input" value={payload.trigger} onChange={(e) => onChange({ ...payload, trigger: e.target.value as AttackTrigger })}>
                {TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="shmup-field-row">
            {(payload.shape === "arc" || payload.shape === "radialBurst") && (
              <label className="shmup-field shmup-field--inline">
                <span>Projectile count</span>
                <input
                  type="number"
                  min={1}
                  className="shmup-input shmup-input--small"
                  value={payload.projectileCount}
                  onChange={(e) => onChange({ ...payload, projectileCount: Number(e.target.value) })}
                />
              </label>
            )}
            {payload.shape === "arc" && (
              <label className="shmup-field shmup-field--inline">
                <span>Arc spread (deg)</span>
                <input type="number" className="shmup-input shmup-input--small" value={payload.arcSpreadDeg} onChange={(e) => onChange({ ...payload, arcSpreadDeg: Number(e.target.value) })} />
              </label>
            )}
            {payload.aim === "fixed" && (
              <label className="shmup-field shmup-field--inline">
                <span>Fixed angle (deg)</span>
                <input type="number" className="shmup-input shmup-input--small" value={payload.fixedAngleDeg} onChange={(e) => onChange({ ...payload, fixedAngleDeg: Number(e.target.value) })} />
              </label>
            )}
            {payload.aim === "rotating" && (
              <label className="shmup-field shmup-field--inline">
                <span>Rotation speed (deg/sec)</span>
                <input
                  type="number"
                  className="shmup-input shmup-input--small"
                  value={payload.rotationSpeedDeg}
                  onChange={(e) => onChange({ ...payload, rotationSpeedDeg: Number(e.target.value) })}
                />
              </label>
            )}
            {payload.trigger === "continuous" && (
              <label className="shmup-field shmup-field--inline">
                <span>Interval (ms)</span>
                <input type="number" className="shmup-input shmup-input--small" value={payload.intervalMs} onChange={(e) => onChange({ ...payload, intervalMs: Number(e.target.value) })} />
              </label>
            )}
            {(payload.trigger === "onTrigger" || payload.shape === "beam") && (
              <label className="shmup-field shmup-field--inline">
                <span>Telegraph (ms)</span>
                <input type="number" className="shmup-input shmup-input--small" value={payload.telegraphMs} onChange={(e) => onChange({ ...payload, telegraphMs: Number(e.target.value) })} />
              </label>
            )}
            {payload.trigger === "onProximity" && (
              <label className="shmup-field shmup-field--inline">
                <span>Proximity radius</span>
                <input
                  type="number"
                  className="shmup-input shmup-input--small"
                  value={payload.proximityRadius}
                  onChange={(e) => onChange({ ...payload, proximityRadius: Number(e.target.value) })}
                />
              </label>
            )}
          </div>

          <p className="shmup-hint">Bullet fired by this payload — bullets are minimal enemies (spec §7), so this can fire its own bullets recursively.</p>
          <BulletForm bullet={payload.bullet ?? createBlankBullet()} onChange={(bullet) => onChange({ ...payload, bullet })} depth={depth} />
        </>
      )}
    </div>
  );
}
