import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useOsDialog } from "./OsDialog";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { fsStore } from "./filesystem/FileSystemStore";
import "./NotebookApp.css";

interface NotebookAppProps {
  fileId: string;
  fileName: string;
  onFileSaved?: (fileId: string, fileName: string) => void;
}

export default function NotebookApp({ fileId, fileName, onFileSaved }: NotebookAppProps) {
  const { showDialog } = useOsDialog();

  const fsFile = fsStore.getFile(fileId);
  const isReadOnly = fsFile?.readonly ?? false;
  const filePath = fsStore.getPath(fileId);

  const [content, setContent] = useState(() => fsStore.getFile(fileId)?.content ?? "");
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset when a different file is opened in the same window
  const prevIdRef = useRef(fileId);
  useEffect(() => {
    if (prevIdRef.current !== fileId) {
      prevIdRef.current = fileId;
      setContent(fsStore.getFile(fileId)?.content ?? "");
      setDirty(false);
      setLastSaved(null);
    }
  }, [fileId]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    setDirty(true);
  }

  const contentRef = useRef(content);
  contentRef.current = content;

  const save = useCallback(() => {
    fsStore.writeFile(fileId, contentRef.current);
    setDirty(false);
    setLastSaved(new Date().toLocaleTimeString());
    showDialog(`File saved.\n\n${fileName}`, { title: "Notebook", icon: "💾" });
    onFileSaved?.(fileId, fileName);
  }, [fileId, fileName, showDialog, onFileSaved]);

  const toggleWordWrap = useCallback(() => setWordWrap((w) => !w), []);

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
      <div className="nsnb-pathbar nsnb-sunken">{filePath}</div>
      <textarea
        ref={textareaRef}
        className={`nsnb-editor${wordWrap ? "" : " nsnb-editor--nowrap"}`}
        value={content}
        onChange={handleChange}
        readOnly={isReadOnly}
        spellCheck={false}
        aria-label={`Editing ${fileName}`}
      />
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
