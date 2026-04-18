import { useState, useEffect, useRef } from "react";
import { useOsDialog } from "./OsDialog";
import "./NotebookApp.css";

interface NotebookAppProps {
  filePath: string;
  fileName: string;
  initialContent: string;
}

const STORAGE_PREFIX = "ns97_notebook_";

function storageKey(path: string) {
  return STORAGE_PREFIX + path;
}

export default function NotebookApp({ filePath, fileName, initialContent }: NotebookAppProps) {
  const { showDialog } = useOsDialog();
  const isNewFile = filePath === "(new file)";

  const [content, setContent] = useState(() => {
    if (isNewFile) return "";
    const saved = localStorage.getItem(storageKey(filePath));
    return saved !== null ? saved : initialContent;
  });

  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset when a different file is opened in the same window (shouldn't normally happen,
  // but guards against edge cases)
  const prevPathRef = useRef(filePath);
  useEffect(() => {
    if (prevPathRef.current !== filePath) {
      prevPathRef.current = filePath;
      const saved = localStorage.getItem(storageKey(filePath));
      setContent(saved !== null ? saved : initialContent);
      setDirty(false);
      setLastSaved(null);
    }
  }, [filePath, initialContent]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    setDirty(true);
  }

  function save() {
    localStorage.setItem(storageKey(filePath), content);
    setDirty(false);
    const now = new Date();
    setLastSaved(now.toLocaleTimeString());
    showDialog(`File saved.\n\n${fileName}`, { title: "Notebook", icon: "💾" });
  }

  const lineCount = content.split("\n").length;
  const charCount = content.length;

  const isReadOnly = !isNewFile && initialContent !== undefined &&
    (filePath.includes("System\\") || filePath.includes("Drivers\\") || filePath.includes("Temp\\"));

  return (
    <div className="nsnb-window">
      {/* ── Menu bar ── */}
      <div className="nsnb-menubar">
        <button className="nsnb-menubar__item" onClick={save} disabled={isReadOnly || !dirty}>
          💾 Save
        </button>
        <div className="nsnb-menubar__sep" />
        <button
          className={`nsnb-menubar__item${wordWrap ? " nsnb-menubar__item--active" : ""}`}
          onClick={() => setWordWrap((w) => !w)}
        >
          ↵ Wrap
        </button>
        <div className="nsnb-menubar__sep" />
        {isReadOnly && (
          <span className="nsnb-menubar__badge">READ-ONLY</span>
        )}
        {dirty && !isReadOnly && (
          <span className="nsnb-menubar__badge nsnb-menubar__badge--dirty">UNSAVED</span>
        )}
        {lastSaved && !dirty && (
          <span className="nsnb-menubar__badge nsnb-menubar__badge--saved">Saved {lastSaved}</span>
        )}
      </div>

      {/* ── Path bar ── */}
      <div className="nsnb-pathbar nsnb-sunken">{filePath}</div>

      {/* ── Text area ── */}
      <textarea
        ref={textareaRef}
        className={`nsnb-editor${wordWrap ? "" : " nsnb-editor--nowrap"}`}
        value={content}
        onChange={handleChange}
        readOnly={isReadOnly}
        spellCheck={false}
        aria-label={`Editing ${fileName}`}
      />

      {/* ── Status bar ── */}
      <div className="nsnb-statusbar nsnb-sunken">
        <span>{lineCount} line{lineCount !== 1 ? "s" : ""}</span>
        <span className="nsnb-statusbar__sep">|</span>
        <span>{charCount} char{charCount !== 1 ? "s" : ""}</span>
        {isReadOnly && (
          <>
            <span className="nsnb-statusbar__sep">|</span>
            <span>Read-only (system file)</span>
          </>
        )}
      </div>
    </div>
  );
}
