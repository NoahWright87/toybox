import { useState, useRef } from "react";
import "./DesktopIcon.css";

interface DesktopIconProps {
  id: string;
  title: string;
  icon: string;
  onOpen: (id: string) => void;
}

export default function DesktopIcon({ id, title, icon, onOpen }: DesktopIconProps) {
  const [selected, setSelected] = useState(false);
  const lastClickRef = useRef(0);

  function handleClick() {
    const now = Date.now();
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

    if (isTouchDevice) {
      onOpen(id);
      return;
    }

    if (now - lastClickRef.current < 400) {
      onOpen(id);
      setSelected(false);
    } else {
      setSelected(true);
    }
    lastClickRef.current = now;
  }

  return (
    <button
      className={`ns-icon${selected ? " ns-icon--selected" : ""}`}
      onClick={handleClick}
      onBlur={() => setSelected(false)}
      aria-label={`Open ${title}`}
    >
      <span className="ns-icon__graphic">{icon}</span>
      <span className="ns-icon__label">{title}</span>
    </button>
  );
}
