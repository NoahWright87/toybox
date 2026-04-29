import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ROOT, type FsFolder, type FsFile } from "../NsDoors97/fileSystem";
import "./NsToS.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TerminalLine {
  text: string;
  error?: boolean;
}

// ── Boot sequence lines (simulates CONFIG.SYS + AUTOEXEC.BAT running) ─────────

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

function getFolder(cwd: string[]): FsFolder | null {
  let node: FsFolder = ROOT;
  for (const seg of cwd) {
    const child = node.children.find(
      (c) => c.kind === "folder" && c.name.toLowerCase() === seg.toLowerCase()
    );
    if (!child || child.kind !== "folder") return null;
    node = child;
  }
  return node;
}

function promptStr(cwd: string[]): string {
  if (cwd.length === 0) return "C:\\>";
  return `C:\\${cwd.join("\\")}\\>`;
}

// ── Retro date/time (real time, date shifted 30 years back) ──────────────────

function retroDate(): string {
  const now = new Date();
  const retro = new Date(now);
  retro.setFullYear(now.getFullYear() - 30);
  return retro.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function retroTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NsToS() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [ready, setReady] = useState(false);
  const [cwd, setCwd] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom whenever lines change
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // Boot sequence — type out lines with small delays
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    let delay = 0;
    for (const text of BOOT_LINES) {
      delay += 45 + Math.random() * 35;
      const d = delay;
      timers.push(
        setTimeout(() => {
          if (!cancelled) setLines((prev) => [...prev, { text }]);
        }, d)
      );
    }

    timers.push(
      setTimeout(() => {
        if (!cancelled) setReady(true);
      }, delay + 60)
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  // Focus the input when the terminal is ready
  useEffect(() => {
    if (ready && inputRef.current) {
      inputRef.current.focus();
    }
  }, [ready]);

  const addLines = useCallback((newLines: TerminalLine[]) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  // ── Command processor ─────────────────────────────────────────────────────

  const processCommand = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        addLines([{ text: `${promptStr(cwd)}` }]);
        return;
      }

      setCmdHistory((prev) => [trimmed, ...prev].slice(0, 50));
      setHistoryIdx(-1);

      // Echo the command line
      addLines([{ text: `${promptStr(cwd)}${trimmed}` }]);

      // Normalize "CD.." → "CD .."
      const normalized = trimmed.replace(/^(cd)(\.\.+)$/i, "$1 $2");
      const parts = normalized.split(/\s+/);
      const cmd = parts[0].toUpperCase();
      const args = parts.slice(1);

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
            { text: "  CD [dir]        Change directory  (CD.. to go up, CD \\ for root)" },
            { text: "  DATE            Display the current date" },
            { text: "  DIR             List files in current directory" },
            { text: "  DOORS           Launch NS Doors 97" },
            { text: "  ECHO [text]     Display a message" },
            { text: "  HELP            Display this help text" },
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
          addLines([
            { text: "" },
            { text: `Current date is: ${retroDate()}` },
            { text: "" },
          ]);
          break;
        }

        case "TIME": {
          addLines([
            { text: "" },
            { text: `Current time is: ${retroTime()}` },
            { text: "" },
          ]);
          break;
        }

        case "ECHO": {
          const msg = args.join(" ");
          addLines([{ text: msg || "ECHO is on." }, { text: "" }]);
          break;
        }

        case "DIR": {
          const folder = getFolder(cwd);
          if (!folder) {
            addLines([{ text: "Invalid directory.", error: true }, { text: "" }]);
            break;
          }
          const dateStr = retroDate();
          const dirPath = cwd.length === 0 ? "C:\\" : `C:\\${cwd.join("\\")}\\`;
          addLines([
            { text: "" },
            { text: ` Directory of ${dirPath}` },
            { text: "" },
          ]);
          for (const node of folder.children) {
            if (node.kind === "folder") {
              addLines([{ text: `${dateStr}    <DIR>    ${node.name}` }]);
            } else {
              addLines([{ text: `${dateStr}             ${node.name}` }]);
            }
          }
          const dirCount = folder.children.filter((n) => n.kind === "folder").length;
          const fileCount = folder.children.filter((n) => n.kind === "file").length;
          addLines([
            { text: "" },
            { text: `       ${fileCount} file(s)     ${dirCount} dir(s)` },
            { text: "" },
          ]);
          break;
        }

        case "CD": {
          const arg = args[0] ?? "";

          if (!arg || arg === ".") {
            addLines([{ text: "" }]);
            break;
          }

          // Go to root
          if (arg === "\\" || arg.toUpperCase() === "C:\\" || arg.toUpperCase() === "C:") {
            setCwd([]);
            addLines([{ text: "" }]);
            break;
          }

          // Go up
          if (arg === ".." || arg.startsWith("..")) {
            setCwd((prev) => prev.slice(0, -1));
            addLines([{ text: "" }]);
            break;
          }

          // Navigate into a child folder
          const folder = getFolder(cwd);
          const target = folder?.children.find(
            (c) => c.kind === "folder" && c.name.toLowerCase() === arg.toLowerCase()
          );
          if (!target || target.kind !== "folder") {
            addLines([
              { text: `Invalid directory - "${arg}"`, error: true },
              { text: "" },
            ]);
            break;
          }
          setCwd((prev) => [...prev, target.name]);
          addLines([{ text: "" }]);
          break;
        }

        case "TYPE": {
          const filename = args.join(" ");
          if (!filename) {
            addLines([
              { text: "Required parameter missing.", error: true },
              { text: "" },
            ]);
            break;
          }
          const folder = getFolder(cwd);
          const file = folder?.children.find(
            (c): c is FsFile =>
              c.kind === "file" && c.name.toLowerCase() === filename.toLowerCase()
          );
          if (!file) {
            addLines([
              { text: `File not found - "${filename}"`, error: true },
              { text: "" },
            ]);
            break;
          }
          if (!file.content) {
            addLines([
              { text: "This file type cannot be displayed.", error: true },
              { text: "" },
            ]);
            break;
          }
          addLines([
            { text: "" },
            ...file.content.split("\n").map((t) => ({ text: t })),
            { text: "" },
          ]);
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
          addLines([
            { text: "" },
            { text: "Delete everything? Let's not." },
            { text: "" },
          ]);
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
          addLines([
            { text: "" },
            { text: "Loading NS Doors 97..." },
            { text: "" },
          ]);
          setTimeout(() => {
            navigate("/", { state: { fromTos: true } });
          }, 800);
          break;
        }

        default: {
          addLines([
            { text: `Bad command or file name - "${trimmed}"` },
            { text: "" },
          ]);
          break;
        }
      }
    },
    [cwd, addLines, navigate]
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
        addLines([{ text: `${promptStr(cwd)}${input}^C` }, { text: "" }]);
        setInput("");
        setHistoryIdx(-1);
      }
    },
    [input, processCommand, historyIdx, cmdHistory, cwd, addLines]
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
            {line.text || " "}
          </div>
        ))}
      </div>
      {ready && (
        <div className="ns-tos__input-row">
          <span className="ns-tos__prompt">{promptStr(cwd)}</span>
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
