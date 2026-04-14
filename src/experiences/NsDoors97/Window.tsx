import React, { useRef, useEffect, useState } from "react";
import Draggable from "react-draggable";
import TitleBar from "./TitleBar";
import "./Window.css";

interface WindowProps {
  id: string;
  title: string;
  icon?: string;
  zIndex: number;
  defaultPosition: { x: number; y: number };
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  children: React.ReactNode;
}

function useIsPortrait() {
  const [isPortrait, setIsPortrait] = useState(
    () => window.matchMedia("(orientation: portrait)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isPortrait;
}

export default function Window({
  id,
  title,
  icon,
  zIndex,
  defaultPosition,
  onClose,
  onFocus,
  children,
}: WindowProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const isPortrait = useIsPortrait();

  const titleBar = (
    <TitleBar title={title} icon={icon} onClose={() => onClose(id)} />
  );

  // Portrait mode: maximized, no drag
  if (isPortrait) {
    return (
      <div
        ref={nodeRef}
        className="ns-window ns-window--maximized"
        style={{ zIndex }}
        onMouseDown={() => onFocus(id)}
      >
        {titleBar}
        <div className="ns-window__content">{children}</div>
      </div>
    );
  }

  // Landscape / desktop: draggable
  return (
    <Draggable
      handle=".ns-titlebar"
      defaultPosition={defaultPosition}
      bounds="parent"
      nodeRef={nodeRef}
      onStart={() => onFocus(id)}
    >
      <div
        ref={nodeRef}
        className="ns-window"
        style={{ zIndex }}
        onMouseDown={() => onFocus(id)}
      >
        {titleBar}
        <div className="ns-window__content">{children}</div>
      </div>
    </Draggable>
  );
}
