import "./TitleBar.css";

interface TitleBarProps {
  title: string;
  icon?: string;
  isMaximized?: boolean;
  onClose: () => void;
  onShrink?: () => void;
  onEmbiggen?: () => void;
}

export default function TitleBar({
  title,
  icon,
  isMaximized = false,
  onClose,
  onShrink,
  onEmbiggen,
}: TitleBarProps) {
  return (
    <div className="win95-titlebar">
      <div className="win95-titlebar__left">
        {icon && <span className="win95-titlebar__icon">{icon}</span>}
        <span className="win95-titlebar__title">{title}</span>
      </div>
      <div className="win95-titlebar__controls">
        {onShrink && (
          <button
            className="win95-titlebar__btn"
            onClick={onShrink}
            aria-label="Shrink"
            title="Shrink"
          >
            ▼
          </button>
        )}
        {onEmbiggen && (
          <button
            className="win95-titlebar__btn"
            onClick={onEmbiggen}
            aria-label={isMaximized ? "Restore" : "Embiggen"}
            title={isMaximized ? "Restore" : "Embiggen"}
          >
            {isMaximized ? "▽" : "▲"}
          </button>
        )}
        <button
          className="win95-titlebar__btn win95-titlebar__btn--close"
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
