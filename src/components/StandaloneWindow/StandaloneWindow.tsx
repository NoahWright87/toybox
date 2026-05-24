import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TitleBar from "../Window/TitleBar";
import MenuBar, { type MenuBarMenu } from "../MenuBar/MenuBar";
import { WindowMenuContext } from "../Window/useWindowMenus";
import "./StandaloneWindow.css";

interface StandaloneWindowProps {
  title: string;
  icon?: string;
  helpContent?: React.ReactNode;
  /** Fill the entire viewport; titlebar + menubar at top, content takes remaining space. Default: false (centered floating window). */
  fullscreen?: boolean;
  /** If set, show this confirmation message before navigating away on close. */
  confirmClose?: string;
  children: React.ReactNode;
}

export default function StandaloneWindow({ title, icon, helpContent, fullscreen, confirmClose, children }: StandaloneWindowProps) {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  // Dynamic menus registered by child apps via useWindowMenus
  const [dynamicMenus, setDynamicMenus] = useState<MenuBarMenu[] | null>(null);
  const dynamicMenusRef = useRef<MenuBarMenu[] | null>(null);
  const registerMenus = useCallback((m: MenuBarMenu[]) => {
    if (m !== dynamicMenusRef.current) {
      dynamicMenusRef.current = m;
      setDynamicMenus(m);
    }
  }, []);

  function exitToDoors() {
    if (confirmClose && !window.confirm(confirmClose)) return;
    navigate("/doors97", { state: { skipBoot: true } });
  }

  const exitItem = { label: "Exit to Doors", onClick: exitToDoors };
  const helpMenu: MenuBarMenu | null = helpContent
    ? { label: "Help", items: [{ label: "Keyboard Shortcuts", onClick: () => setShowHelp(true) }] }
    : null;

  // If dynamic menus include a "File" menu, inject "Exit to Doors" at the bottom of it.
  // Otherwise prepend a standalone File menu so the exit option is always reachable.
  let menus: MenuBarMenu[];
  if (dynamicMenus && dynamicMenus.some(m => m.label === "File")) {
    menus = [
      ...dynamicMenus.map(m =>
        m.label === "File"
          ? { ...m, items: [...m.items, { separator: true as const }, exitItem] }
          : m
      ),
      ...(helpMenu ? [helpMenu] : []),
    ];
  } else {
    const fileMenu: MenuBarMenu = { label: "File", items: [exitItem] };
    menus = [fileMenu, ...(dynamicMenus ?? []), ...(helpMenu ? [helpMenu] : [])];
  }

  return (
    <div className={`standalone-page${fullscreen ? " standalone-page--fullscreen" : ""}`}>
      <div className={`standalone-window${fullscreen ? " standalone-window--fullscreen" : ""}`}>
        <TitleBar title={title} icon={icon} onClose={exitToDoors} />
        <MenuBar menus={menus} />
        <div className={`standalone-window__content${fullscreen ? " standalone-window__content--fullscreen" : ""}`}>
          <WindowMenuContext.Provider value={registerMenus}>
            {children}
          </WindowMenuContext.Provider>
        </div>

        {showHelp && helpContent && (
          <div className="standalone-help-overlay" onClick={() => setShowHelp(false)}>
            <div
              className="standalone-help-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="standalone-help-dialog__titlebar">
                <span>Keyboard Shortcuts</span>
                <button
                  className="standalone-help-dialog__close"
                  onClick={() => setShowHelp(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="standalone-help-dialog__body">
                {helpContent}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
