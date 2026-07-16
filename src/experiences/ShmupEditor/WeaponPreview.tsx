import { useEffect, useRef } from "react";
import { resolveSpriteUrl } from "./enemySprites";
import { computePreviewBullets, isTelegraphing, sweepOffsetDeg } from "./weaponPreview";
import type { UnitDef, WeaponDef } from "./unitTypes";

interface WeaponPreviewProps {
  weapon: WeaponDef;
  /** The Unit library, to resolve `weapon.spawnUnitId` and draw its actual sprite as each bullet dot instead of a generic placeholder. */
  units: UnitDef[];
}

const CANVAS_SIZE = 200;
const ORIGIN = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
/** Fixed reference point standing in for "the player," purely for aimMode "player" — same "no live player exists at authoring time" approximation the rest of the editor already accepts. Directly below the shooter, matching the aim-angle convention (0=right, 90=down) so the default fixedAngleDeg (90) points the same direction a player-aimed weapon's reference line does. */
const PLAYER_REF = { x: ORIGIN.x, y: CANVAS_SIZE - 20 };
const BULLET_SIZE = 12;
const ARC_LINE_LENGTH = 30;

function aimAngleDeg(weapon: WeaponDef): number {
  if (weapon.aimMode === "fixed") return weapon.fixedAngleDeg;
  return (Math.atan2(PLAYER_REF.y - ORIGIN.y, PLAYER_REF.x - ORIGIN.x) * 180) / Math.PI;
}

/**
 * Live animated visualization of what a Weapon actually fires — Noah's
 * request, since the arc/count/spacing/sweep fields are hard to picture
 * from numbers alone in a genre this visual. Recomputes bullet dot
 * positions from scratch every frame via `weaponPreview.ts`'s pure
 * functions (same "declarative, not accumulated state" shape as
 * `movementPreview.ts`) so it can't drift out of sync with in-progress
 * form edits — there's no simulation state to reset when a field changes.
 */
export default function WeaponPreview({ weapon, units }: WeaponPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spawnImgRef = useRef<HTMLImageElement | null>(null);
  const startRef = useRef(performance.now());

  const spawnUnit = weapon.spawnUnitId ? units.find((u) => u.id === weapon.spawnUnitId) : undefined;
  const spawnSpriteUrl = spawnUnit ? resolveSpriteUrl(spawnUnit.spriteId, spawnUnit.customSprite) : null;

  // Reload the bullet image whenever the spawned Unit's sprite changes; a stale <img> would otherwise keep drawing the previous Unit's art.
  useEffect(() => {
    if (!spawnSpriteUrl) {
      spawnImgRef.current = null;
      return;
    }
    const img = new Image();
    img.src = spawnSpriteUrl;
    spawnImgRef.current = img;
  }, [spawnSpriteUrl]);

  useEffect(() => {
    let raf: number;
    function frame() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) draw(ctx, weapon, performance.now() - startRef.current, spawnImgRef.current);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weapon]);

  return <canvas ref={canvasRef} className="shmup-weapon-preview" width={CANVAS_SIZE} height={CANVAS_SIZE} />;
}

function draw(ctx: CanvasRenderingContext2D, weapon: WeaponDef, elapsedMs: number, spawnImg: HTMLImageElement | null) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = "#180800";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const aim = aimAngleDeg(weapon);
  const sweep = sweepOffsetDeg(weapon, elapsedMs);

  if (weapon.aimMode === "player") {
    ctx.strokeStyle = "rgba(102, 255, 238, 0.4)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(ORIGIN.x, ORIGIN.y);
    ctx.lineTo(PLAYER_REF.x, PLAYER_REF.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#66ffee";
    ctx.beginPath();
    ctx.arc(PLAYER_REF.x, PLAYER_REF.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Arc boundary reference lines, sweeping live with the arc.
  ctx.strokeStyle = "rgba(255, 204, 136, 0.5)";
  ctx.setLineDash([2, 2]);
  for (const boundaryDeg of [weapon.arcStartDeg, weapon.arcEndDeg]) {
    const rad = ((aim + sweep + boundaryDeg) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(ORIGIN.x, ORIGIN.y);
    ctx.lineTo(ORIGIN.x + Math.cos(rad) * ARC_LINE_LENGTH, ORIGIN.y + Math.sin(rad) * ARC_LINE_LENGTH);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Shooter marker — glows during telegraph wind-up.
  const telegraphing = isTelegraphing(weapon, elapsedMs);
  ctx.fillStyle = telegraphing ? "#ff6b00" : "#cc4400";
  ctx.beginPath();
  ctx.arc(ORIGIN.x, ORIGIN.y, telegraphing ? 9 : 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffcc88";
  ctx.lineWidth = 2;
  ctx.stroke();

  const bullets = computePreviewBullets(weapon, aim, elapsedMs);
  for (const bullet of bullets) {
    const x = ORIGIN.x + bullet.x;
    const y = ORIGIN.y + bullet.y;
    if (x < -BULLET_SIZE || x > CANVAS_SIZE + BULLET_SIZE || y < -BULLET_SIZE || y > CANVAS_SIZE + BULLET_SIZE) continue;
    ctx.globalAlpha = Math.max(0, bullet.alpha);
    if (spawnImg && spawnImg.complete && spawnImg.naturalWidth > 0) {
      ctx.drawImage(spawnImg, x - BULLET_SIZE / 2, y - BULLET_SIZE / 2, BULLET_SIZE, BULLET_SIZE);
    } else {
      ctx.fillStyle = "#ffcc44";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
