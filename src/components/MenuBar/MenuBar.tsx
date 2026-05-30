import { useState, useEffect, useRef } from "react";
import "./MenuBar.css";

export interface MenuBarItem {
  label?: string;
  onClick?: () => void;
  separator?: true;
  disabled?: boolean;
  checked?: boolean;
  radioGroup?: string; // when set, renders • instead of ✓ (consumer manages exclusivity)
}

export interface MenuBarMenu {
  label: string;
  items: MenuBarItem[];
}

interface MenuBarProps {
  menus: MenuBarMenu[];
}

export default function MenuBar({ menus }: MenuBarProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openIdx === null) return;
    const handleOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenIdx(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIdx(null);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [openIdx]);

  return (
    <div className="win95-menubar" ref={barRef}>
      {menus.map((menu, i) => (
        <div key={menu.label} className="win95-menubar__entry">
          <button
            className={`win95-menubar__label${openIdx === i ? " win95-menubar__label--open" : ""}`}
            onMouseDown={() => setOpenIdx(openIdx === i ? null : i)}
          >
            {menu.label}
          </button>
          {openIdx === i && (
            <ul className="win95-menubar__dropdown" role="menu">
              {menu.items.map((item, j) =>
                item.separator ? (
                  <li key={j} className="win95-menubar__sep" role="separator" />
                ) : (
                  <li key={j} role="menuitem">
                    <button
                      className={`win95-menubar__option${item.disabled ? " win95-menubar__option--disabled" : ""}`}
                      onClick={() => {
                        if (!item.disabled) {
                          item.onClick?.();
                          setOpenIdx(null);
                        }
                      }}
                      disabled={item.disabled}
                    >
                      <span className="win95-menubar__check">
                        {item.checked ? (item.radioGroup ? "•" : "✓") : ""}
                      </span>
                      <span className="win95-menubar__option-label">
                        {item.label}
                      </span>
                    </button>
                  </li>
                )
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
