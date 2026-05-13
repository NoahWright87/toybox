import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useOsDialog } from "./OsDialog";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
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

  // Capture latest content via ref so save() stays stable
  const contentRef = useRef(content);
  contentRef.current = content;

  const save = useCallback(() => {
    localStorage.setItem(storageKey(filePath), contentRef.current);
    setDirty(false);
    const now = new Date();
    setLastSaved(now.toLocaleTimeString());
    showDialog(`File saved.\n\n${fileName}`, { title: "Notebook", icon: "💾" });
  }, [filePath, fileName, showDialog]);

  const toggleWordWrap = useCallback(() => setWordWrap((w) => !w), []);

  const isReadOnly = !isNewFile && initialContent !== undefined &&
    (filePath.includes("System\\") || filePath.includes("Drivers\\") || filePath.includes("Temp\\"));

  const menus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "File",
      items: [
        { label: "Save", onClick: save, disabled: isReadOnly || !dirty },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Word Wrap", onClick: toggleWordWrap, checked: wordWrap },
      ],
    },
  ], [save, isReadOnly, dirty, wordWrap, toggleWordWrap]);

  useWindowMenus(menus);

  const lineCount = content.split("\n").length;
  const charCount = content.length;

  return (
    <div className="nsnb-window">
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
            <span>Read-only</span>
          </>
        )}
        {dirty && !isReadOnly && (
          <>
            <span className="nsnb-statusbar__sep">|</span>
            <span className="nsnb-statusbar__unsaved">Unsaved</span>
          </>
        )}
        {lastSaved && !dirty && !isReadOnly && (
          <>
            <span className="nsnb-statusbar__sep">|</span>
            <span>Saved {lastSaved}</span>
          </>
        )}
      </div>
    </div>
  );
}
