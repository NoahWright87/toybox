import React, { useRef } from "react";
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
  const isTouchDevice =
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  return (
    <Draggable
      handle=".ns-titlebar"
      defaultPosition={defaultPosition}
      bounds="parent"
      nodeRef={nodeRef}
      disabled={isTouchDevice}
      onStart={() => onFocus(id)}
    >
      <div
        ref={nodeRef}
        className="ns-window"
        style={{ zIndex }}
        onMouseDown={() => onFocus(id)}
      >
        <TitleBar
          title={title}
          icon={icon}
          onClose={() => onClose(id)}
        />
        <div className="ns-window__content">{children}</div>
      </div>
    </Draggable>
  );
}
