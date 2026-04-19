import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "./ScreensaverPage.css";

interface ScreensaverPageProps {
  children: ReactNode;
  background?: string;
}

export default function ScreensaverPage({
  children,
  background = "#000",
}: ScreensaverPageProps) {
  const navigate = useNavigate();
  const readyRef = useRef(false);
  const mouseOriginRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { readyRef.current = true; }, 800);
    return () => clearTimeout(t);
  }, []);

  function exit() {
    if (readyRef.current) navigate("/");
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!readyRef.current) return;
      if (!mouseOriginRef.current) {
        mouseOriginRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const dx = e.clientX - mouseOriginRef.current.x;
      const dy = e.clientY - mouseOriginRef.current.y;
      if (dx * dx + dy * dy > 25) navigate("/");
    }
    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
  }, [navigate]);

  return (
    <div
      className="ss-page"
      style={{ background }}
      tabIndex={-1}
      onKeyDown={exit}
    >
      <div className="ss-page__content">{children}</div>
      <div
        className="ss-page__dismiss"
        onClick={exit}
        onTouchStart={exit}
        aria-label="Click to exit"
      />
      <p className="ss-page__hint">Click or move mouse to exit</p>
    </div>
  );
}
