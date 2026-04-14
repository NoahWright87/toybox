import React from "react";
import "./TitleBar.css";

interface TitleBarProps {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

export default function TitleBar({ title, icon, onClose, onMinimize, onMaximize }: TitleBarProps) {
  return (
    <div className="ns-titlebar">
      <div className="ns-titlebar__left">
        {icon && <span className="ns-titlebar__icon">{icon}</span>}
        <span className="ns-titlebar__title">{title}</span>
      </div>
      <div className="ns-titlebar__controls">
        <button
          className="ns-titlebar__btn"
          onClick={() => onMinimize?.()}
          aria-label="Minimize"
          title="Minimize"
        >
          —
        </button>
        <button
          className="ns-titlebar__btn"
          onClick={() => onMaximize?.()}
          aria-label="Maximize"
          title="Maximize"
        >
          □
        </button>
        <button
          className="ns-titlebar__btn ns-titlebar__btn--close"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
