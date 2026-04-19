import { useEffect, useRef } from "react";
import Starfield from "../Starfield/Starfield";
import Fireworks from "../Fireworks/Fireworks";
import BouncingShapes from "../BouncingShapes/BouncingShapes";
import ScrollingText from "../ScrollingText/ScrollingText";
import BouncingPolygons from "../BouncingPolygons/BouncingPolygons";
import RainingEmojis from "../RainingEmojis/RainingEmojis";
import { type ScreensaverId, type AllScreensaverSettings, DEFAULT_SETTINGS } from "./screensaverSettings";
import "./ScreensaverOverlay.css";

interface ScreensaverOverlayProps {
  screensaver: ScreensaverId;
  settings?: AllScreensaverSettings;
  onDismiss: () => void;
}

export default function ScreensaverOverlay({
  screensaver,
  settings = DEFAULT_SETTINGS,
  onDismiss,
}: ScreensaverOverlayProps) {
  // Grace period so the overlay doesn't dismiss the instant it appears
  const readyRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { readyRef.current = true; }, 800);
    return () => clearTimeout(t);
  }, []);

  // Dismiss on mouse movement > 5px
  const mouseOriginRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!readyRef.current) return;
      if (!mouseOriginRef.current) {
        mouseOriginRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const dx = e.clientX - mouseOriginRef.current.x;
      const dy = e.clientY - mouseOriginRef.current.y;
      if (dx * dx + dy * dy > 25) onDismiss();
    }
    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
  }, [onDismiss]);

  function handleDismiss() {
    if (readyRef.current) onDismiss();
  }

  // Keep keyboard focus so keydown events reach us
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => { overlayRef.current?.focus(); }, []);

  return (
    <div
      ref={overlayRef}
      className="ns-screensaver"
      tabIndex={-1}
      onKeyDown={handleDismiss}
    >
      {/* Screensaver renders here — pointer-events disabled so clicks bubble up */}
      <div className="ns-screensaver__content">
        {screensaver === "starfield"        && <Starfield settings={settings.starfield} />}
        {screensaver === "fireworks"        && <Fireworks settings={settings.fireworks} />}
        {screensaver === "bouncing-shapes"  && <BouncingShapes settings={settings["bouncing-shapes"]} />}
        {screensaver === "scrolling-text"   && <ScrollingText settings={settings["scrolling-text"]} />}
        {screensaver === "bouncing-polygons" && <BouncingPolygons settings={settings["bouncing-polygons"]} />}
        {screensaver === "raining-emojis"  && <RainingEmojis settings={settings["raining-emojis"]} />}
      </div>

      {/* Transparent dismiss layer sits on top, captures clicks/touches */}
      <div
        className="ns-screensaver__dismiss"
        onClick={handleDismiss}
        onTouchStart={handleDismiss}
        aria-label="Click to exit screensaver"
      />

      <p className="ns-screensaver__hint">Click or move mouse to exit</p>
    </div>
  );
}
