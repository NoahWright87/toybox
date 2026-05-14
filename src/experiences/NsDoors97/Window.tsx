import React, { useRef, useEffect, useState, useCallback } from "react";
import Draggable from "react-draggable";
import TitleBar from "../../components/Window/TitleBar";
import ResizeHandles from "../../components/Window/ResizeHandles";
import MenuBar, { type MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { WindowMenuContext } from "../../components/Window/useWindowMenus";
import "./Window.css";

interface WindowProps {
  id: string;
  title: string;
  icon?: string;
  zIndex: number;
  defaultPosition: { x: number; y: number };
  width?: number;
  minimized?: boolean;
  menus?: MenuBarMenu[];
  aboutContent?: React.ReactNode;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  onShrink?: (id: string) => void;
  onCloseRequested?: (id: string, proceed: () => void) => void;
  children: React.ReactNode;
}

const TASKBAR_HEIGHT = 42;
const DEFAULT_WIDTH = 440;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

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

function useViewportSize() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return size;
}

export default function Window({
  id,
  title,
  icon,
  zIndex,
  defaultPosition,
  width,
  minimized = false,
  menus,
  aboutContent,
  onClose,
  onFocus,
  onShrink,
  onCloseRequested,
  children,
}: WindowProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const isPortrait = useIsPortrait();
  const { w: viewportWidth } = useViewportSize();

  // Dynamic menus registered by child apps via useWindowMenus
  const [dynamicMenus, setDynamicMenus] = useState<MenuBarMenu[] | null>(null);
  const dynamicMenusRef = useRef<MenuBarMenu[] | null>(null);
  const registerMenus = useCallback((m: MenuBarMenu[]) => {
    if (m !== dynamicMenusRef.current) {
      dynamicMenusRef.current = m;
      setDynamicMenus(m);
    }
  }, []);

  const [pos, setPos] = useState(() => defaultPosition);
  const [size, setSize] = useState<{ width: number; height: number | null }>({
    width: width ?? DEFAULT_WIDTH,
    height: null, // null = auto (content-driven)
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Sync width prop changes (e.g. TicTacToe board size changes) only when not user-resized
  const hasSizeRef = useRef(false);
  useEffect(() => {
    if (!hasSizeRef.current) {
      setSize((prev) => ({ ...prev, width: width ?? DEFAULT_WIDTH }));
    }
  }, [width]);

  const windowWidth = size.width;
  const scale = Math.min(1, (viewportWidth - 8) / windowWidth);

  function handleClose() {
    if (onCloseRequested) {
      onCloseRequested(id, () => onClose(id));
    } else {
      onClose(id);
    }
  }

  function handleDrag(_e: unknown, data: { x: number; y: number }) {
    if (!isMaximized) setPos({ x: data.x, y: data.y });
  }

  function handleResize(newPos: { x: number; y: number }, newSize: { width: number; height: number }) {
    hasSizeRef.current = true;
    setPos(newPos);
    setSize({ width: newSize.width, height: newSize.height });
  }

  function handleEmbiggen() {
    setIsMaximized((m) => !m);
    if (!isMaximized) setShowAbout(false);
  }

  const defaultMenus: MenuBarMenu[] = [
    { label: "File", items: [{ label: "Exit", onClick: handleClose }] },
    {
      label: "Help",
      items: [{ label: "About", onClick: () => setShowAbout(true) }],
    },
  ];

  const resolvedMenus = dynamicMenus ?? menus ?? defaultMenus;

  // ── Portrait: fixed full-screen, no drag/resize ─────────────────────────

  if (isPortrait || minimized) {
    const style: React.CSSProperties = {
      zIndex,
      ...(minimized ? { display: "none" } : {}),
    };
    return (
      <div
        ref={nodeRef}
        className="ns-window ns-window--portrait"
        style={style}
        onMouseDown={() => onFocus(id)}
      >
        <TitleBar
          title={title}
          icon={icon}
          onClose={handleClose}
          onShrink={onShrink ? () => onShrink(id) : undefined}
          onEmbiggen={handleEmbiggen}
          isMaximized={isMaximized}
        />
        {resolvedMenus.length > 0 && <MenuBar menus={resolvedMenus} />}
        <WindowMenuContext.Provider value={registerMenus}>
          <div className="ns-window__content">{children}</div>
        </WindowMenuContext.Provider>
        {showAbout && (
          <AboutOverlay title={title} content={aboutContent} onClose={() => setShowAbout(false)} />
        )}
      </div>
    );
  }

  // ── Desktop: draggable, resizable ────────────────────────────────────────

  const inlineStyle: React.CSSProperties = isMaximized
    ? {
        zIndex,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: TASKBAR_HEIGHT,
        width: "auto",
        height: "auto",
        maxHeight: "none",
        transform: "none",
      }
    : {
        zIndex,
        width: `${windowWidth}px`,
        ...(size.height !== null ? { height: `${size.height}px` } : {}),
        ...(scale < 1 ? { zoom: scale } : {}),
      };

  return (
    <Draggable
      handle=".win95-titlebar"
      cancel=".win95-titlebar__controls"
      position={isMaximized ? { x: 0, y: 0 } : pos}
      onDrag={handleDrag}
      bounds="parent"
      nodeRef={nodeRef}
      onStart={() => onFocus(id)}
      disabled={isMaximized}
    >
      <div
        ref={nodeRef}
        className={`ns-window${isMaximized ? " ns-window--maximized" : ""}`}
        style={inlineStyle}
        onMouseDown={() => onFocus(id)}
      >
        <TitleBar
          title={title}
          icon={icon}
          onClose={handleClose}
          onShrink={onShrink ? () => onShrink(id) : undefined}
          onEmbiggen={handleEmbiggen}
          isMaximized={isMaximized}
        />
        {resolvedMenus.length > 0 && <MenuBar menus={resolvedMenus} />}
        <WindowMenuContext.Provider value={registerMenus}>
          <div className="ns-window__content">{children}</div>
        </WindowMenuContext.Provider>
        {showAbout && (
          <AboutOverlay title={title} content={aboutContent} onClose={() => setShowAbout(false)} />
        )}
        <ResizeHandles
          containerRef={nodeRef}
          onResize={handleResize}
          minWidth={MIN_WIDTH}
          minHeight={MIN_HEIGHT}
          disabled={isMaximized}
        />
      </div>
    </Draggable>
  );
}

// ── Inline About dialog ──────────────────────────────────────────────────────

function AboutOverlay({
  title,
  content,
  onClose,
}: {
  title: string;
  content?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="ns-about-overlay" onClick={onClose}>
      <div className="ns-about-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ns-about-dialog__titlebar">
          <span>About {title}</span>
          <button
            className="ns-about-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="ns-about-dialog__body">
          {content ?? (
            <p>NS Doors 97 — a Noahsoft product.</p>
          )}
        </div>
        <div className="ns-about-dialog__footer">
          <button className="ns-about-dialog__ok" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
