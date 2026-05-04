import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./StandaloneWindow.css";

interface StandaloneWindowProps {
  title: string;
  icon?: string;
  helpContent?: React.ReactNode;
  children: React.ReactNode;
}

export default function StandaloneWindow({ title, icon, helpContent, children }: StandaloneWindowProps) {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<"file" | "help" | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  function exitToDoors() {
    navigate("/doors97", { state: { skipBoot: true } });
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="standalone-page">
      <div className="standalone-window">
        <div className="standalone-window__titlebar">
          {icon && <span className="standalone-window__icon">{icon}</span>}
          <span className="standalone-window__title">{title}</span>
          <button
            className="standalone-window__close"
            onClick={exitToDoors}
            aria-label="Exit to Doors"
            title="Exit to Doors"
          >
            ✕
          </button>
        </div>

        <div className="standalone-window__menubar" ref={menuBarRef}>
          <div className="standalone-window__menu">
            <button
              className={`standalone-window__menu-btn${openMenu === "file" ? " standalone-window__menu-btn--open" : ""}`}
              onClick={() => setOpenMenu(openMenu === "file" ? null : "file")}
            >
              File
            </button>
            {openMenu === "file" && (
              <div className="standalone-window__dropdown">
                <button
                  className="standalone-window__dropdown-item"
                  onClick={exitToDoors}
                >
                  Exit to Doors
                </button>
              </div>
            )}
          </div>

          {helpContent && (
            <div className="standalone-window__menu">
              <button
                className={`standalone-window__menu-btn${openMenu === "help" ? " standalone-window__menu-btn--open" : ""}`}
                onClick={() => setOpenMenu(openMenu === "help" ? null : "help")}
              >
                Help
              </button>
              {openMenu === "help" && (
                <div className="standalone-window__dropdown standalone-window__dropdown--help">
                  <div className="standalone-window__help-content">
                    {helpContent}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="standalone-window__content">
          {children}
        </div>
      </div>
    </div>
  );
}
