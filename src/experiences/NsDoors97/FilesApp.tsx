import { useState } from "react";
import { useOsDialog } from "./OsDialog";
import {
  ROOT,
  type FsNode,
  type FsFolder,
  type FsFile,
  getNodeIcon,
} from "./fileSystem";
import "./FilesApp.css";

interface FilesAppProps {
  onOpenApp: (appId: string) => void;
  onOpenNotebook: (path: string, fileName: string, content: string) => void;
}

interface FolderItemProps {
  node: FsNode;
  onOpen: (node: FsNode) => void;
}

function FolderItem({ node, onOpen }: FolderItemProps) {
  const [selected, setSelected] = useState(false);
  const lastClick = { current: 0 };

  function handleClick() {
    const now = Date.now();
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch || now - lastClick.current < 400) {
      onOpen(node);
      setSelected(false);
    } else {
      setSelected(true);
    }
    lastClick.current = now;
  }

  const dimmed = node.kind === "file" && node.type === "tmp";

  return (
    <button
      className={`nsf-item${selected ? " nsf-item--selected" : ""}${dimmed ? " nsf-item--dim" : ""}`}
      onClick={handleClick}
      onBlur={() => setSelected(false)}
      aria-label={node.name}
    >
      <span className="nsf-item__icon">{getNodeIcon(node)}</span>
      <span className="nsf-item__label">{node.name}</span>
    </button>
  );
}

export default function FilesApp({ onOpenApp, onOpenNotebook }: FilesAppProps) {
  const { showDialog } = useOsDialog();

  // Navigation stack: each entry is a FsFolder
  const [stack, setStack] = useState<FsFolder[]>([ROOT]);
  const current = stack[stack.length - 1];

  const pathStr = stack.map((f) => f.name).join("\\").replace("C:\\\\", "C:\\");

  function navigate(folder: FsFolder) {
    setStack((s) => [...s, folder]);
  }

  function goUp() {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }

  function openNode(node: FsNode) {
    if (node.kind === "folder") {
      navigate(node);
      return;
    }
    handleFile(node);
  }

  function handleFile(file: FsFile) {
    // Text files — open in Notebook
    if (file.content !== undefined) {
      const path = pathStr + "\\" + file.name;
      onOpenNotebook(path, file.name, file.content);
      return;
    }

    // Executables with an action
    if (file.action && file.action !== "noop") {
      if (file.action === "notebook") {
        onOpenNotebook("(new file)", "Untitled.txt", "");
        return;
      }
      // Screensavers and games open as experiences
      onOpenApp(file.action);
      return;
    }

    // Non-functional files
    const ext = file.name.split(".").pop()?.toUpperCase() ?? "";
    if (file.type === "tmp") {
      showDialog("This temporary file is damaged and cannot be opened.", { title: "Error", icon: "❌" });
    } else if (["zip", "bmp"].includes(file.type)) {
      showDialog(`Cannot open .${ext} files.\nYou need an additional program to view this file type.`, { title: "Open Error", icon: "⚠️" });
    } else {
      showDialog(`${file.name} is not a valid NS Doors application, or cannot be run in this mode.\n\nError code: 0xC0000034`, { title: "Program Error", icon: "❌" });
    }
  }

  const itemCount = current.children.length;
  const folderCount = current.children.filter((n) => n.kind === "folder").length;

  return (
    <div className="nsf-window">
      {/* ── Menu bar ── */}
      <div className="nsf-menubar">
        {["File", "Edit", "View", "Help"].map((m) => (
          <button
            key={m}
            className="nsf-menubar__item"
            onClick={() => showDialog("This menu is not yet implemented.", { title: m, icon: "ℹ️" })}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="nsf-toolbar">
        <button
          className="nsf-toolbar__btn"
          onClick={goUp}
          disabled={stack.length <= 1}
          title="Up one level"
        >
          ↑ Up
        </button>
        <div className="nsf-toolbar__sep" />
        <span className="nsf-toolbar__label">Address:</span>
        <div className="nsf-toolbar__address nsf-sunken">{pathStr}</div>
      </div>

      {/* ── Content ── */}
      <div className="nsf-content">
        {current.children.length === 0 ? (
          <div className="nsf-empty">This folder is empty.</div>
        ) : (
          current.children.map((node) => (
            <FolderItem key={node.name} node={node} onOpen={openNode} />
          ))
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="nsf-statusbar nsf-sunken">
        {folderCount > 0
          ? `${itemCount} object${itemCount !== 1 ? "s" : ""} (${folderCount} folder${folderCount !== 1 ? "s" : ""})`
          : `${itemCount} object${itemCount !== 1 ? "s" : ""}`}
      </div>
    </div>
  );
}
