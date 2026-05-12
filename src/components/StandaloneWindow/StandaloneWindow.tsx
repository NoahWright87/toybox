import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TitleBar from "../Window/TitleBar";
import MenuBar, { type MenuBarMenu } from "../MenuBar/MenuBar";
import "./StandaloneWindow.css";

interface StandaloneWindowProps {
  title: string;
  icon?: string;
  helpContent?: React.ReactNode;
  children: React.ReactNode;
}

export default function StandaloneWindow({ title, icon, helpContent, children }: StandaloneWindowProps) {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  function exitToDoors() {
    navigate("/doors97", { state: { skipBoot: true } });
  }

  const menus: MenuBarMenu[] = [
    {
      label: "File",
      items: [{ label: "Exit to Doors", onClick: exitToDoors }],
    },
    ...(helpContent
      ? [
          {
            label: "Help",
            items: [{ label: "Keyboard Shortcuts", onClick: () => setShowHelp(true) }],
          },
        ]
      : []),
  ];

  return (
    <div className="standalone-page">
      <div className="standalone-window">
        <TitleBar title={title} icon={icon} onClose={exitToDoors} />
        <MenuBar menus={menus} />
        <div className="standalone-window__content">
          {children}
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
