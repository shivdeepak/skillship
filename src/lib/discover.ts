import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "__pycache__",
]);

/**
 * Recursively collect every directory at or under `root` that contains a
 * `SKILL.md`. Each skill is a flat, top-level directory — a directory that
 * holds a `SKILL.md` is recorded as a skill and NOT descended into, so files
 * bundled inside a skill are never mistaken for nested sub-skills. Related
 * skills live side by side (e.g. `skillship`, `skillship-author`). Returns
 * sorted paths.
 */
function collectSkillDirs(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (existsSync(join(dir, "SKILL.md"))) {
      out.push(dir);
      return;
    }
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      try {
        if (statSync(full).isDirectory()) walk(full);
      } catch {
        // unreadable entry, skip
      }
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Discover skill directories to operate on, given a project/skill root.
 *
 * Resolution order:
 *   1. `<dir>/SKILL.md` exists → that single skill.
 *   2. `skills/<dir>/SKILL.md` exists (relative to cwd) → the `skills/`
 *      convention, so a bare skill name resolves without the redundant prefix.
 *      Namespaced names map `:` → `-` to match the flat sibling on-disk folder
 *      (e.g. `skillship:author` → `skills/skillship-author`).
 *   3. otherwise → every skill (recursively) under `<dir>/skills/`, or under
 *      `<dir>` itself when there is no `skills/` subfolder.
 *
 * Returns absolute, sorted skill directory paths (empty when none found).
 */
export function discoverSkillDirs(dir: string): string[] {
  const abs = resolve(dir);
  if (existsSync(join(abs, "SKILL.md"))) return collectSkillDirs(abs);

  for (const candidate of new Set([
    dir,
    dir.replaceAll(":", "-"),
  ])) {
    const underSkills = resolve(process.cwd(), "skills", candidate);
    if (existsSync(join(underSkills, "SKILL.md"))) {
      return collectSkillDirs(underSkills);
    }
  }

  const skillsRoot = existsSync(join(abs, "skills")) ? join(abs, "skills") : abs;
  return collectSkillDirs(skillsRoot);
}
