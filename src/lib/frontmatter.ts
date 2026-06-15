/**
 * Minimal YAML frontmatter parser for SKILL.md files.
 *
 * It intentionally only supports the subset needed for skill frontmatter:
 * scalars, block scalars (>, >-, >+, |, |-, |+), and one level of nested maps
 * (e.g. `metadata:` with indented children). The origin `validate.py` had a bug
 * where block scalars were mis-joined with following keys; this parser keeps
 * block-scalar continuation lines separate from sibling keys by tracking
 * indentation.
 */

export interface Frontmatter {
  name?: string;
  description?: string;
  license?: string;
  metadata?: Record<string, string>;
  "allowed-tools"?: string | string[];
  [key: string]: unknown;
}

export interface ParsedSkill {
  frontmatter: Frontmatter;
  body: string;
}

const FENCE = /^---\s*$/;

function splitFrontmatter(content: string): {
  raw: string;
  body: string;
} {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length === 0 || !FENCE.test(lines[0])) {
    return { raw: "", body: normalized };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { raw: "", body: normalized };
  }
  const raw = lines.slice(1, end).join("\n");
  const body = lines.slice(end + 1).join("\n");
  return { raw, body };
}

interface Line {
  indent: number;
  text: string; // trimmed-right content after indent
  raw: string;
}

function tokenize(raw: string): Line[] {
  return raw.split("\n").map((raw) => {
    const match = raw.match(/^(\s*)(.*)$/);
    const indent = match ? match[1].length : 0;
    const text = match ? match[2] : raw;
    return { indent, text, raw };
  });
}

function stripComment(value: string): string {
  // Remove an unquoted trailing `# comment`. Respect quotes.
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "#" && !inSingle && !inDouble) {
      // Only treat as comment if preceded by whitespace or at start.
      if (i === 0 || /\s/.test(value[i - 1])) {
        return value.slice(0, i).trimEnd();
      }
    }
  }
  return value;
}

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2) {
    if (v.startsWith('"') && v.endsWith('"')) {
      return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n");
    }
    if (v.startsWith("'") && v.endsWith("'")) {
      return v.slice(1, -1).replace(/''/g, "'");
    }
  }
  return v;
}

const BLOCK_SCALAR = /^([|>])([+-]?)\s*$/;

/**
 * Collect a block scalar's content given the lines after the key, the index to
 * start at, and the parent key indent. Returns the folded/literal string and
 * the next index to continue parsing from.
 */
function collectBlockScalar(
  lines: Line[],
  start: number,
  parentIndent: number,
  style: "|" | ">",
  chomp: string,
): { value: string; next: number } {
  const collected: string[] = [];
  let i = start;
  let blockIndent = -1;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const isBlank = line.text === "";
    if (isBlank) {
      collected.push("");
      continue;
    }
    if (line.indent <= parentIndent) break;
    if (blockIndent === -1) blockIndent = line.indent;
    collected.push(line.raw.slice(blockIndent));
  }
  // Trim trailing blank lines for chomp handling.
  let value: string;
  if (style === ">") {
    // Folded: join lines with spaces, blank lines become newlines.
    const parts: string[] = [];
    let buffer: string[] = [];
    const flush = () => {
      if (buffer.length) {
        parts.push(buffer.join(" "));
        buffer = [];
      }
    };
    for (const l of collected) {
      if (l === "") {
        flush();
        parts.push("");
      } else {
        buffer.push(l);
      }
    }
    flush();
    value = parts.join("\n").replace(/\n{2,}/g, "\n");
  } else {
    value = collected.join("\n");
  }
  // Chomping.
  if (chomp === "-") {
    value = value.replace(/\n+$/, "");
  } else if (chomp === "+") {
    // keep
  } else {
    value = value.replace(/\n+$/, "\n");
    value = value.replace(/\n$/, "");
  }
  value = value.trim();
  return { value, next: i };
}

function parseFrontmatter(raw: string): Frontmatter {
  const fm: Frontmatter = {};
  if (!raw.trim()) return fm;
  const lines = tokenize(raw);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.text === "" || line.text.startsWith("#")) {
      i++;
      continue;
    }
    // Only parse top-level keys here (indent 0).
    if (line.indent !== 0) {
      i++;
      continue;
    }
    const colon = line.text.indexOf(":");
    if (colon === -1) {
      i++;
      continue;
    }
    const key = line.text.slice(0, colon).trim();
    let rest = line.text.slice(colon + 1).trim();
    const blockMatch = rest.match(BLOCK_SCALAR);
    if (blockMatch) {
      const style = blockMatch[1] as "|" | ">";
      const chomp = blockMatch[2] || "";
      const { value, next } = collectBlockScalar(
        lines,
        i + 1,
        line.indent,
        style,
        chomp,
      );
      fm[key] = value;
      i = next;
      continue;
    }
    if (rest === "") {
      // Could be a nested map or a list.
      const childIndent = line.indent;
      const children: Record<string, string> = {};
      let j = i + 1;
      let sawChild = false;
      for (; j < lines.length; j++) {
        const child = lines[j];
        if (child.text === "" || child.text.startsWith("#")) continue;
        if (child.indent <= childIndent) break;
        const cColon = child.text.indexOf(":");
        if (cColon === -1) continue;
        const cKey = child.text.slice(0, cColon).trim();
        const cVal = unquote(stripComment(child.text.slice(cColon + 1).trim()));
        children[cKey] = cVal;
        sawChild = true;
      }
      if (sawChild) {
        fm[key] = children;
      } else {
        fm[key] = "";
      }
      i = j;
      continue;
    }
    // Inline list: [a, b]
    if (rest.startsWith("[") && rest.endsWith("]")) {
      const inner = rest.slice(1, -1).trim();
      fm[key] = inner
        ? inner.split(",").map((s) => unquote(s.trim()))
        : [];
      i++;
      continue;
    }
    rest = unquote(stripComment(rest));
    fm[key] = rest;
    i++;
  }
  return fm;
}

export function parseSkill(content: string): ParsedSkill {
  const { raw, body } = splitFrontmatter(content);
  return {
    frontmatter: parseFrontmatter(raw),
    body,
  };
}
