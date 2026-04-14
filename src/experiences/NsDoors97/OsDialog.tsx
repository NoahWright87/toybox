import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import "./OsDialog.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DialogState {
  title: string;
  message: string;
  icon: string;
}

interface OsDialogContextValue {
  showDialog: (message: string, opts?: { title?: string; icon?: string }) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

export const OsDialogContext = createContext<OsDialogContextValue>({
  showDialog: () => {},
});

export function useOsDialog() {
  return useContext(OsDialogContext);
}

// ── Dialog component ──────────────────────────────────────────────────────────

function OsDialog({
  title,
  message,
  icon,
  onClose,
}: DialogState & { onClose: () => void }) {
  return (
    <div className="ns-dialog-overlay" onClick={onClose}>
      <div
        className="ns-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal
        aria-labelledby="ns-dialog-title"
        aria-describedby="ns-dialog-msg"
      >
        {/* Title bar */}
        <div className="ns-dialog__titlebar">
          <span className="ns-dialog__titlebar-icon">⚠️</span>
          <span className="ns-dialog__titlebar-title" id="ns-dialog-title">
            {title}
          </span>
          <button
            className="ns-dialog__titlebar-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="ns-dialog__body">
          <span className="ns-dialog__icon" aria-hidden>
            {icon}
          </span>
          <p className="ns-dialog__message" id="ns-dialog-msg">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="ns-dialog__footer">
          <button className="ns-dialog__ok" onClick={onClose} autoFocus>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function OsDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const showDialog = useCallback(
    (message: string, opts?: { title?: string; icon?: string }) => {
      setDialog({
        title: opts?.title ?? "NS Doors 97",
        message,
        icon: opts?.icon ?? "⚠️",
      });
    },
    []
  );

  return (
    <OsDialogContext.Provider value={{ showDialog }}>
      {children}
      {dialog && (
        <OsDialog
          title={dialog.title}
          message={dialog.message}
          icon={dialog.icon}
          onClose={() => setDialog(null)}
        />
      )}
    </OsDialogContext.Provider>
  );
}
