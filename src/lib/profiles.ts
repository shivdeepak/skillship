import { basename } from "node:path";
import type { Frontmatter, ParsedSkill } from "./frontmatter.js";

export type ProfileName =
  | "spec"
  | "cursor"
  | "claude-web"
  | "claude-cowork"
  | "all";

export const PROFILE_NAMES: ProfileName[] = [
  "spec",
  "cursor",
  "claude-web",
  "claude-cowork",
  "all",
];

export type Severity = "error" | "warning";

export interface Finding {
  severity: Severity;
  check: string;
  message: string;
}

export interface ValidationResult {
  profile: ProfileName;
  ok: boolean;
  findings: Finding[];
}

const DESCRIPTION_MAX: Record<Exclude<ProfileName, "all">, number> = {
  spec: 1024,
  cursor: 1024,
  "claude-web": 200,
  "claude-cowork": 200,
};

const BODY_RECOMMENDED_MAX_LINES = 500;

// A skill name is one or more lowercase/number/hyphen segments. Segments may be
// joined with `:` to namespace a skill under a parent (e.g. `skillship:author`).
export const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*(:[a-z0-9]+(-[a-z0-9]+)*)*$/;

function descriptionMax(profile: ProfileName): number {
  if (profile === "all") {
    // Strictest combination across all concrete profiles.
    return Math.min(...Object.values(DESCRIPTION_MAX));
  }
  return DESCRIPTION_MAX[profile];
}

/**
 * A skill's `name` must line up with its on-disk folder. Skills are flat,
 * top-level directories, so the folder must equal the name (or its `:` → `-`
 * variant, since `:` is not portable in directory names — `skillship:author`
 * lives in `skillship-author/`).
 */
function nameMatchesFolder(name: string, skillDir: string): boolean {
  const folder = basename(skillDir);
  return folder === name || folder === name.replaceAll(":", "-");
}

function checkName(
  fm: Frontmatter,
  skillDir: string,
  findings: Finding[],
): void {
  const name = typeof fm.name === "string" ? fm.name : undefined;
  if (!name) {
    findings.push({
      severity: "error",
      check: "name-present",
      message: "`name` is missing from frontmatter.",
    });
    return;
  }
  if (!NAME_RE.test(name)) {
    findings.push({
      severity: "error",
      check: "name-format",
      message: `\`name\` "${name}" must be lowercase letters, numbers, and single hyphens, optionally namespaced with \`:\` (e.g. "skillship:author").`,
    });
  }
  if (!nameMatchesFolder(name, skillDir)) {
    findings.push({
      severity: "error",
      check: "name-matches-folder",
      message: `\`name\` "${name}" must match its folder; \`:\` maps to a hyphen (e.g. "skillship:author" → "skillship-author").`,
    });
  }
}

function checkDescription(
  fm: Frontmatter,
  max: number,
  findings: Finding[],
): void {
  const desc = typeof fm.description === "string" ? fm.description : undefined;
  if (!desc || desc.trim() === "") {
    findings.push({
      severity: "error",
      check: "description-present",
      message: "`description` is missing or empty.",
    });
    return;
  }
  if (/[<>]/.test(desc)) {
    findings.push({
      severity: "error",
      check: "description-xml",
      message: "`description` must not contain `<` or `>` characters.",
    });
  }
  if (desc.length > max) {
    findings.push({
      severity: "error",
      check: "description-length",
      message: `\`description\` is ${desc.length} chars; limit is ${max}.`,
    });
  }
}

function checkBody(body: string, findings: Finding[]): void {
  const lineCount = body.split("\n").length;
  if (lineCount > BODY_RECOMMENDED_MAX_LINES) {
    findings.push({
      severity: "warning",
      check: "body-length",
      message: `Body is ${lineCount} lines; recommended <= ${BODY_RECOMMENDED_MAX_LINES}.`,
    });
  }
}

export function validateProfile(
  skill: ParsedSkill,
  skillDir: string,
  profile: ProfileName,
): ValidationResult {
  const findings: Finding[] = [];

  checkName(skill.frontmatter, skillDir, findings);
  checkDescription(skill.frontmatter, descriptionMax(profile), findings);
  checkBody(skill.body, findings);

  const ok = !findings.some((f) => f.severity === "error");
  return { profile, ok, findings };
}
