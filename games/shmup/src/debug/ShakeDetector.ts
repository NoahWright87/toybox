// Magnitude-delta shake detection (accelerationIncludingGravity, frame-to-frame
// jolt) with a cooldown so one physical shake fires exactly one callback, not
// a burst. Mobile's stand-in for the debug overlay's backtick key (C12 #151) —
// there's no keyboard to press on a phone.
const SHAKE_DELTA_THRESHOLD = 18; // m/s^2 of combined-axis jolt between readings
const SHAKE_COOLDOWN_MS = 1000;

export class ShakeDetector {
  private lastX = 0;
  private lastY = 0;
  private lastZ = 0;
  private lastShakeAt = 0;
  private readonly handler = (e: DeviceMotionEvent) => this.onMotion(e);

  constructor(private readonly onShake: () => void) {
    window.addEventListener("devicemotion", this.handler);
  }

  private onMotion(e: DeviceMotionEvent): void {
    const acc = e.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const delta = Math.abs(acc.x - this.lastX) + Math.abs(acc.y - this.lastY) + Math.abs(acc.z - this.lastZ);
    this.lastX = acc.x;
    this.lastY = acc.y;
    this.lastZ = acc.z;

    const now = Date.now();
    if (delta > SHAKE_DELTA_THRESHOLD && now - this.lastShakeAt > SHAKE_COOLDOWN_MS) {
      this.lastShakeAt = now;
      this.onShake();
    }
  }

  destroy(): void {
    window.removeEventListener("devicemotion", this.handler);
  }
}

/**
 * iOS 13+ gates `devicemotion` behind a permission prompt that only resolves
 * when requested from inside a user-gesture handler — call this directly from
 * a tap/click handler, not after an async hop. No-op (and no prompt) on
 * browsers without the gate (Android, desktop), so it's safe to call always.
 */
export async function requestMotionPermission(): Promise<void> {
  const ctor = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> };
  if (typeof ctor.requestPermission === "function") {
    await ctor.requestPermission().catch(() => {});
  }
}
