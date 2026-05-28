import { useState, useMemo } from "react";
import { useOsDialog } from "./OsDialog";
import { useWindowMenus } from "../../components/Window/useWindowMenus";
import type { MenuBarMenu } from "../../components/MenuBar/MenuBar";
import { useFS } from "./filesystem/FSContext";
import { getNodeIcon, ROOT_ID, DUMPSTER_ID, type FSNode, type FSFile } from "./filesystem/types";
import { fsStore } from "./filesystem/FileSystemStore";
import "./FilesApp.css";

interface FilesAppProps {
  startFolderId?: string;
  isDumpster?: boolean;
  onOpenApp: (appId: string) => void;
  onOpenNotebook: (fileId: string, fileName: string) => void;
  onOpenFSNode?: (nodeId: string) => void;
  onQuit?: () => void;
}

interface FolderItemProps {
  node: FSNode;
  onOpen: (node: FSNode) => void;
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

  const dimmed = node.kind === "file" && node.fileType === "tmp";

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

export default function FilesApp({
  startFolderId,
  isDumpster,
  onOpenApp,
  onOpenNotebook,
  onOpenFSNode,
  onQuit,
}: FilesAppProps) {
  const { showDialog } = useOsDialog();
  const store = useFS();

  const rootId = startFolderId ?? ROOT_ID;
  const [stack, setStack] = useState<string[]>([rootId]);
  const currentFolderId = stack[stack.length - 1];
  const children = store.getChildren(currentFolderId);
  const pathStr = store.getPath(currentFolderId);

  const canGoUp = stack.length > 1;

  const dumpsterMenuItems = isDumpster
    ? [
        {
          label: "Empty Dumpster",
          onClick: () => {
            showDialog("Are you sure? This will permanently delete all items in the Recycle Bin.", {
              title: "Empty Recycle Bin",
              icon: "🗑️",
              buttons: ["Yes", "No"],
              onButton: (btn: string) => {
                if (btn === "Yes") {
                  store.emptyDumpster();
                  showDialog("Recycle Bin emptied.", { title: "Done", icon: "✅" });
                }
              },
            });
          },
        },
        { separator: true as const },
      ]
    : [];

  const menus = useMemo<MenuBarMenu[]>(() => [
    {
      label: "File",
      items: [
        ...dumpsterMenuItems,
        ...(onQuit ? [{ label: "Exit", onClick: onQuit }] : [{ label: "(not implemented)", disabled: true as const }]),
      ],
    },
    { label: "Edit", items: [{ label: "(not implemented)", disabled: true as const }] },
    { label: "View", items: [{ label: "(not implemented)", disabled: true as const }] },
    {
      label: "Help",
      items: [
        {
          label: "About Files",
          onClick: () => showDialog(
            isDumpster
              ? "Recycle Bin\nItems sent here are not permanently deleted until the bin is emptied."
              : "NS Doors 97 Files\nBrowse and open files on this computer.",
            { title: isDumpster ? "About Recycle Bin" : "About Files", icon: "ℹ️" }
          ),
        },
      ],
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [showDialog, onQuit, isDumpster, store]);

  useWindowMenus(menus);

  function navigate(folderId: string) {
    setStack((s) => [...s, folderId]);
  }

  function goUp() {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }

  function openNode(node: FSNode) {
    if (node.kind === "folder") {
      navigate(node.id);
      return;
    }
    if (node.kind === "shortcut") {
      onOpenFSNode?.(node.id);
      return;
    }
    handleFile(node as FSFile);
  }

  function handleFile(file: FSFile) {
    // Readable text-like files
    const textTypes = ["text", "bat", "sys", "ini", "dat"] as const;
    const isTextLike = (textTypes as readonly string[]).includes(file.fileType);
    if (isTextLike && (file.content || file.fileType === "text")) {
      onOpenNotebook(file.id, file.name);
      return;
    }

    // Executables with an app ID
    if (file.appId) {
      if (file.appId === "tos-only") {
        showDialog(
          "HELL.EXE must be launched from NS-TOS.\n\nOpen NS-TOS and type:\n  HELL.EXE\n\nDouble-clicking does not work.",
          { title: "Cannot Run Program", icon: "⛔" }
        );
        return;
      }
      onOpenApp(file.appId);
      return;
    }

    // Non-functional file types
    const ext = file.name.split(".").pop()?.toUpperCase() ?? "";
    if (file.fileType === "tmp") {
      showDialog("This temporary file is damaged and cannot be opened.", { title: "Error", icon: "❌" });
    } else if (["zip", "bmp", "png", "wav"].includes(file.fileType)) {
      showDialog(
        `Cannot open .${ext} files.\nYou need an additional program to view this file type.`,
        { title: "Open Error", icon: "⚠️" }
      );
    } else {
      showDialog(
        `${file.name} is not a valid NS Doors application, or cannot be run in this mode.\n\nError code: 0xC0000034`,
        { title: "Program Error", icon: "❌" }
      );
    }
  }

  function handleDeleteSelected(node: FSNode) {
    if (node.system) {
      showDialog("This item is required by the system and cannot be deleted.", { title: "Error", icon: "⛔" });
      return;
    }
    const inDumpster = node.parentId === DUMPSTER_ID;
    const msg = inDumpster
      ? `Permanently delete "${node.name}"?`
      : `Move "${node.name}" to the Recycle Bin?`;
    showDialog(msg, {
      title: "Confirm Delete",
      icon: "🗑️",
      buttons: ["Yes", "No"],
      onButton: (btn: string) => {
        if (btn === "Yes") fsStore.deleteNode(node.id);
      },
    });
  }

  const folderCount = children.filter((n) => n.kind === "folder").length;
  const itemCount = children.length;

  return (
    <div className="nsf-window">
      <div className="nsf-toolbar">
        <button
          className="nsf-toolbar__btn"
          onClick={goUp}
          disabled={!canGoUp}
          title="Up one level"
        >
          ↑ Up
        </button>
        {isDumpster && (
          <button
            className="nsf-toolbar__btn"
            onClick={() => {
              showDialog("Are you sure? This will permanently delete all items in the Recycle Bin.", {
                title: "Empty Recycle Bin",
                icon: "🗑️",
                buttons: ["Yes", "No"],
                onButton: (btn: string) => {
                  if (btn === "Yes") {
                    store.emptyDumpster();
                    showDialog("Recycle Bin emptied.", { title: "Done", icon: "✅" });
                  }
                },
              });
            }}
            title="Empty Recycle Bin"
          >
            🗑️ Empty
          </button>
        )}
        <div className="nsf-toolbar__sep" />
        <span className="nsf-toolbar__label">Address:</span>
        <div className="nsf-toolbar__address nsf-sunken">{pathStr}</div>
      </div>

      <div className="nsf-content">
        {children.length === 0 ? (
          <div className="nsf-empty">
            {isDumpster ? "The Recycle Bin is empty." : "This folder is empty."}
          </div>
        ) : (
          children.map((node) => (
            <FolderItem
              key={node.id}
              node={node}
              onOpen={(n) => {
                if (isDumpster && n.kind !== "folder") {
                  handleDeleteSelected(n);
                } else {
                  openNode(n);
                }
              }}
            />
          ))
        )}
      </div>

      <div className="nsf-statusbar nsf-sunken">
        {folderCount > 0
          ? `${itemCount} object${itemCount !== 1 ? "s" : ""} (${folderCount} folder${folderCount !== 1 ? "s" : ""})`
          : `${itemCount} object${itemCount !== 1 ? "s" : ""}`}
      </div>
    </div>
  );
}
