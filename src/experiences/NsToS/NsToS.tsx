import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { ROOT_ID, type FSFile } from "../NsDoors97/filesystem/types";
import "./NsToS.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TerminalLine {
  text: string;
  error?: boolean;
}

// ── Boot sequence lines ────────────────────────────────────────────────────────

const BOOT_LINES: string[] = [
  "NS-TOS Version 7.22",
  "Copyright 1997 Noahsoft Corporation. All rights reserved.",
  "",
  "Loading C:\\CONFIG.SYS...",
  "Loading C:\\AUTOEXEC.BAT...",
  "",
  "Welcome to NS Doors 97.",
  "",
  "Type HELP for a list of commands.",
  "Type DOORS to launch NS Doors 97.",
  "",
];

// ── Filesystem helpers ────────────────────────────────────────────────────────

function promptStr(cwdId: string): string {
  return fsStore.getPath(cwdId) + ">";
}

// ── Retro date/time (real time, date shifted 30 years back) ──────────────────

function retroDate(): string {
  const now = new Date();
  const retro = new Date(now);
  retro.setFullYear(now.getFullYear() - 30);
  return retro.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function retroTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NsToS() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [ready, setReady] = useState(false);
  const [cwdId, setCwdId] = useState<string>(ROOT_ID);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // Boot sequence
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let delay = 0;
    for (const text of BOOT_LINES) {
      delay += 45 + Math.random() * 35;
      const d = delay;
      timers.push(setTimeout(() => {
        if (!cancelled) setLines((prev) => [...prev, { text }]);
      }, d));
    }
    timers.push(setTimeout(() => {
      if (!cancelled) setReady(true);
    }, delay + 60));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (ready && inputRef.current) inputRef.current.focus();
  }, [ready]);

  const addLines = useCallback((newLines: TerminalLine[]) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  // ── Command processor ─────────────────────────────────────────────────────

  const processCommand = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        addLines([{ text: promptStr(cwdId) }]);
        return;
      }

      setCmdHistory((prev) => [trimmed, ...prev].slice(0, 50));
      setHistoryIdx(-1);
      addLines([{ text: `${promptStr(cwdId)}${trimmed}` }]);

      // Normalize "CD.." → "CD .."
      const normalized = trimmed.replace(/^(cd)(\.\.+)$/i, "$1 $2");
      // Split on first whitespace only so "ECHO hello world" stays intact
      const spaceIdx = normalized.indexOf(" ");
      const cmd = (spaceIdx === -1 ? normalized : normalized.slice(0, spaceIdx)).toUpperCase();
      const argStr = spaceIdx === -1 ? "" : normalized.slice(spaceIdx + 1);
      const args = argStr.split(/\s+/).filter(Boolean);

      switch (cmd) {
        case "CLS": {
          setLines([]);
          break;
        }

        case "HELP":
        case "?": {
          addLines([
            { text: "" },
            { text: "Available commands:" },
            { text: "" },
            { text: "  CLS             Clear the screen" },
            { text: "  CD [dir]        Change directory  (supports multi-level: cd Programs\\Games)" },
            { text: "  DATE            Display the current date" },
            { text: "  DEL [file]      Delete a file (moves to Recycle Bin)" },
            { text: "  DIR             List files in current directory" },
            { text: "  DOORS           Launch NS Doors 97" },
            { text: "  ECHO [text]     Display a message (ECHO text > file.txt writes a file)" },
            { text: "  HELP            Display this help text" },
            { text: "  MKDIR [dir]     Create a new directory" },
            { text: "  REN [old] [new] Rename a file or folder" },
            { text: "  RMDIR [dir]     Remove an empty directory" },
            { text: "  TIME            Display the current time" },
            { text: "  TYPE [file]     Display contents of a text file" },
            { text: "  VER             Display NS-TOS version" },
            { text: "" },
          ]);
          break;
        }

        case "VER": {
          addLines([
            { text: "" },
            { text: "NS-TOS Version 7.22" },
            { text: "Copyright 1997 Noahsoft Corporation. All rights reserved." },
            { text: "" },
          ]);
          break;
        }

        case "DATE": {
          addLines([{ text: "" }, { text: `Current date is: ${retroDate()}` }, { text: "" }]);
          break;
        }

        case "TIME": {
          addLines([{ text: "" }, { text: `Current time is: ${retroTime()}` }, { text: "" }]);
          break;
        }

        case "ECHO": {
          // Handle ECHO text > filename
          const redirectIdx = argStr.lastIndexOf(">");
          if (redirectIdx !== -1) {
            const text = argStr.slice(0, redirectIdx).trim();
            const filename = argStr.slice(redirectIdx + 1).trim();
            if (!filename) {
              addLines([{ text: "Syntax error.", error: true }, { text: "" }]);
              break;
            }
            const existing = fsStore.findChild(cwdId, filename);
            if (existing && existing.kind === "file") {
              fsStore.writeFile(existing.id, text);
            } else if (!existing) {
              fsStore.createFile(cwdId, filename, { fileType: "text", content: text });
            } else {
              addLines([{ text: `Cannot write to "${filename}": not a file.`, error: true }, { text: "" }]);
              break;
            }
            addLines([{ text: "" }]);
            break;
          }
          addLines([{ text: argStr || "ECHO is on." }, { text: "" }]);
          break;
        }

        case "DIR": {
          const children = fsStore.getChildren(cwdId);
          const dirPath = fsStore.getPath(cwdId) + "\\";
          const dateStr = retroDate();
          addLines([{ text: "" }, { text: ` Directory of ${dirPath}` }, { text: "" }]);
          for (const node of children) {
            if (node.kind === "folder") {
              addLines([{ text: `${dateStr}    <DIR>    ${node.name}` }]);
            } else {
              addLines([{ text: `${dateStr}             ${node.name}` }]);
            }
          }
          const dirCount = children.filter((n) => n.kind === "folder").length;
          const fileCount = children.length - dirCount;
          addLines([
            { text: "" },
            { text: `       ${fileCount} file(s)     ${dirCount} dir(s)` },
            { text: "" },
          ]);
          break;
        }

        case "CD": {
          const arg = argStr.trim();

          if (!arg || arg === ".") {
            addLines([{ text: "" }]);
            break;
          }

          // Root shortcuts
          if (arg === "\\" || arg.toUpperCase() === "C:\\" || arg.toUpperCase() === "C:") {
            setCwdId(ROOT_ID);
            addLines([{ text: "" }]);
            break;
          }

          // Walk through path segments (supports multi-level: Programs\Games)
          const isAbsolute = /^C:[\\\/]/i.test(arg) || arg.startsWith("\\");
          const segments = arg
            .replace(/^C:[\\\/]/i, "")
            .replace(/^[\\\/]/, "")
            .split(/[\\\/]/);

          let currentId = isAbsolute ? ROOT_ID : cwdId;
          let failed = false;

          for (const seg of segments) {
            if (!seg || seg === ".") continue;
            if (seg === "..") {
              const node = fsStore.getNode(currentId);
              currentId = node?.parentId ?? ROOT_ID;
              continue;
            }
            const child = fsStore.findChild(currentId, seg);
            if (!child || child.kind !== "folder") {
              failed = true;
              break;
            }
            currentId = child.id;
          }

          if (failed) {
            addLines([{ text: `Invalid directory - "${arg}"`, error: true }, { text: "" }]);
            break;
          }
          setCwdId(currentId);
          addLines([{ text: "" }]);
          break;
        }

        case "TYPE": {
          const filename = argStr.trim();
          if (!filename) {
            addLines([{ text: "Required parameter missing.", error: true }, { text: "" }]);
            break;
          }
          const child = fsStore.findChild(cwdId, filename);
          if (!child || child.kind !== "file") {
            addLines([{ text: `File not found - "${filename}"`, error: true }, { text: "" }]);
            break;
          }
          const file = child as FSFile;
          if (!file.content) {
            addLines([{ text: "This file type cannot be displayed.", error: true }, { text: "" }]);
            break;
          }
          addLines([
            { text: "" },
            ...file.content.split("\n").map((t) => ({ text: t })),
            { text: "" },
          ]);
          break;
        }

        case "MKDIR":
        case "MD": {
          const dirname = argStr.trim();
          if (!dirname) {
            addLines([{ text: "Required parameter missing.", error: true }, { text: "" }]);
            break;
          }
          if (fsStore.findChild(cwdId, dirname)) {
            addLines([{ text: `A subdirectory or file "${dirname}" already exists.`, error: true }, { text: "" }]);
            break;
          }
          fsStore.createFolder(cwdId, dirname);
          addLines([{ text: "" }]);
          break;
        }

        case "RMDIR":
        case "RD": {
          const dirname = argStr.trim();
          if (!dirname) {
            addLines([{ text: "Required parameter missing.", error: true }, { text: "" }]);
            break;
          }
          const rmdirTarget = fsStore.findChild(cwdId, dirname);
          if (!rmdirTarget || rmdirTarget.kind !== "folder") {
            addLines([{ text: `Directory not found - "${dirname}"`, error: true }, { text: "" }]);
            break;
          }
          if (rmdirTarget.system) {
            addLines([{ text: "Access denied.", error: true }, { text: "" }]);
            break;
          }
          if (fsStore.getChildren(rmdirTarget.id).length > 0) {
            addLines([{ text: "Directory is not empty.", error: true }, { text: "" }]);
            break;
          }
          fsStore.deleteNode(rmdirTarget.id);
          addLines([{ text: "" }]);
          break;
        }

        case "DEL":
        case "ERASE": {
          const filename = argStr.trim();
          if (!filename) {
            addLines([{ text: "Required parameter missing.", error: true }, { text: "" }]);
            break;
          }
          const delTarget = fsStore.findChild(cwdId, filename);
          if (!delTarget) {
            addLines([{ text: `File not found - "${filename}"`, error: true }, { text: "" }]);
            break;
          }
          if (delTarget.system) {
            addLines([{ text: "Access denied.", error: true }, { text: "" }]);
            break;
          }
          if (delTarget.kind === "folder") {
            addLines([{ text: `Cannot delete directory with DEL. Use RMDIR.`, error: true }, { text: "" }]);
            break;
          }
          fsStore.deleteNode(delTarget.id);
          addLines([{ text: "" }]);
          break;
        }

        case "REN":
        case "RENAME": {
          if (args.length < 2) {
            addLines([{ text: "Required parameter missing.", error: true }, { text: "" }]);
            break;
          }
          const oldName = args[0];
          const newName = args.slice(1).join(" ");
          const renTarget = fsStore.findChild(cwdId, oldName);
          if (!renTarget) {
            addLines([{ text: `File not found - "${oldName}"`, error: true }, { text: "" }]);
            break;
          }
          if (renTarget.system) {
            addLines([{ text: "Access denied.", error: true }, { text: "" }]);
            break;
          }
          fsStore.renameNode(renTarget.id, newName);
          addLines([{ text: "" }]);
          break;
        }

        case "FORMAT": {
          addLines([
            { text: "" },
            { text: `WARNING: All data on drive ${args[0] ?? "C:"} will be lost.` },
            { text: "Format abandoned. (Nice try.)" },
            { text: "" },
          ]);
          break;
        }

        case "DELTREE": {
          addLines([{ text: "" }, { text: "Delete everything? Let's not." }, { text: "" }]);
          break;
        }

        case "SCANDISK": {
          addLines([
            { text: "" },
            { text: "ScanDisk v7.22" },
            { text: "Checking drive C:..." },
            { text: "" },
            { text: "All clusters OK. No errors found." },
            { text: "(Some clusters are suspicious but we won't mention it.)" },
            { text: "" },
          ]);
          break;
        }

        case "DOORS": {
          addLines([{ text: "" }, { text: "Loading NS Doors 97..." }, { text: "" }]);
          setTimeout(() => navigate("/", { state: { fromTos: true } }), 800);
          break;
        }

        case "HELL.EXE": {
          const hellFile = fsStore.findChild(cwdId, "HELL.EXE");
          if (!hellFile || hellFile.kind !== "file") {
            addLines([
              { text: `Bad command or file name - "${trimmed}"` },
              { text: `HINT: Navigate to the EGO folder first. Try: cd EGO` },
              { text: "" },
            ]);
            break;
          }
          addLines([
            { text: "" },
            { text: "HELL v0.3 — EGO SOFTWARE INC." },
            { text: "Loading..." },
            { text: "" },
          ]);
          setTimeout(() => navigate("/hell"), 900);
          break;
        }

        case "HELL": {
          addLines([
            { text: `Bad command or file name - "${trimmed}"` },
            { text: `Did you mean: HELL.EXE` },
            { text: "" },
          ]);
          break;
        }

        case "SHMUP.EXE": {
          addLines([
            { text: "" },
            { text: "NOAHSOFT presents: SHMUP" },
            { text: "Loading... (placeholder build)" },
            { text: "" },
          ]);
          setTimeout(() => { window.location.href = "/shmup/"; }, 800);
          break;
        }

        case "SHMUP": {
          addLines([
            { text: `Bad command or file name - "${trimmed}"` },
            { text: `Did you mean: SHMUP.EXE` },
            { text: "" },
          ]);
          break;
        }

        default: {
          addLines([{ text: `Bad command or file name - "${trimmed}"` }, { text: "" }]);
          break;
        }
      }
    },
    [cwdId, addLines, navigate]
  );

  // ── Keyboard handling ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        processCommand(input);
        setInput("");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (cmdHistory.length === 0) return;
        const next = Math.min(historyIdx + 1, cmdHistory.length - 1);
        setHistoryIdx(next);
        setInput(cmdHistory[next]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = historyIdx - 1;
        setHistoryIdx(next);
        setInput(next >= 0 ? cmdHistory[next] : "");
      } else if (e.key === "Escape") {
        e.preventDefault();
        setInput("");
        setHistoryIdx(-1);
      } else if (e.key === "c" && e.ctrlKey) {
        e.preventDefault();
        addLines([{ text: `${promptStr(cwdId)}${input}^C` }, { text: "" }]);
        setInput("");
        setHistoryIdx(-1);
      }
    },
    [input, processCommand, historyIdx, cmdHistory, cwdId, addLines]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ns-tos" onClick={() => inputRef.current?.focus()}>
      <div className="ns-tos__output" ref={outputRef}>
        {lines.map((line, i) => (
          <div
            key={i}
            className={`ns-tos__line${line.error ? " ns-tos__line--error" : ""}`}
          >
            {line.text || " "}
          </div>
        ))}
      </div>
      {ready && (
        <div className="ns-tos__input-row">
          <span className="ns-tos__prompt">{promptStr(cwdId)}</span>
          <input
            ref={inputRef}
            className="ns-tos__input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Terminal input"
          />
        </div>
      )}
    </div>
  );
}
