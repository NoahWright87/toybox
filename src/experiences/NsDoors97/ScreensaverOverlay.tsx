import { useEffect, useRef } from "react";
import Starfield from "../Starfield/Starfield";
import Fireworks from "../Fireworks/Fireworks";
import BouncingShapes from "../BouncingShapes/BouncingShapes";
import "./ScreensaverOverlay.css";

export type ScreensaverId = "starfield" | "fireworks" | "bouncing-shapes";

interface ScreensaverOverlayProps {
  screensaver: ScreensaverId;
  onDismiss: () => void;
}

export default function ScreensaverOverlay({
  screensaver,
  onDismiss,
}: ScreensaverOverlayProps) {
  // Grace period so the overlay doesn't dismiss the instant it appears
  const readyRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      readyRef.current = true;
    }, 800);
    return () => clearTimeout(t);
  }, []);

  function handleDismiss() {
    if (readyRef.current) onDismiss();
  }

  // Keep keyboard focus so keydown events reach us
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  return (
    <div
      ref={overlayRef}
      className="ns-screensaver"
      tabIndex={-1}
      onKeyDown={handleDismiss}
    >
      {/* Screensaver renders here — pointer-events disabled so clicks bubble up */}
      <div className="ns-screensaver__content">
        {screensaver === "starfield" && <Starfield />}
        {screensaver === "fireworks" && <Fireworks />}
        {screensaver === "bouncing-shapes" && <BouncingShapes />}
      </div>

      {/* Transparent dismiss layer sits on top, captures clicks/touches */}
      <div
        className="ns-screensaver__dismiss"
        onClick={handleDismiss}
        onTouchStart={handleDismiss}
        aria-label="Click to exit screensaver"
      />

      <p className="ns-screensaver__hint">Click or press any key to exit</p>
    </div>
  );
}
