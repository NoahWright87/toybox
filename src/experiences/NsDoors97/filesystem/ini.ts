// Simple INI parser / section-updater.
// Comments (lines starting with ; or @REM) and blank lines are preserved
// in updateIniSection; they are stripped by parseIni.

export function parseIni(text: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let cur = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line.startsWith("@")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      cur = line.slice(1, -1);
      if (!sections[cur]) sections[cur] = {};
    } else if (cur) {
      const eq = line.indexOf("=");
      if (eq > 0) sections[cur][line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  return sections;
}

// Update or append a section in an INI string, preserving all other content.
// Existing keys in the section are replaced; unknown keys are preserved;
// new keys are appended at the end of the section.
export function updateIniSection(
  text: string,
  section: string,
  kvs: Record<string, string>,
): string {
  const header = `[${section}]`;
  const lines = text.split("\n");
  const si = lines.findIndex((l) => l.trim() === header);

  if (si === -1) {
    // Section not present — append it
    const block = `${header}\n${Object.entries(kvs).map(([k, v]) => `${k}=${v}`).join("\n")}`;
    return text.trimEnd() + "\n\n" + block + "\n";
  }

  // Find section end (next section header or EOF)
  let ei = lines.length;
  for (let i = si + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("[") && t.endsWith("]")) { ei = i; break; }
  }

  // Rebuild the section, preserving comments and unknown keys
  const out: string[] = [header];
  const done = new Set<string>();
  for (let i = si + 1; i < ei; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith(";") || t.startsWith("@")) { out.push(lines[i]); continue; }
    const eq = t.indexOf("=");
    if (eq > 0) {
      const k = t.slice(0, eq).trim();
      if (k in kvs) { out.push(`${k}=${kvs[k]}`); done.add(k); }
      else out.push(lines[i]);
    } else {
      out.push(lines[i]);
    }
  }
  for (const [k, v] of Object.entries(kvs)) {
    if (!done.has(k)) out.push(`${k}=${v}`);
  }

  return [...lines.slice(0, si), ...out, ...lines.slice(ei)].join("\n");
}
