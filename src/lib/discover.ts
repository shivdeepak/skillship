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
 * `SKILL.md`. Skills may be nested — a parent skill can hold sub-skills under
 * it (e.g. `skillship/author`) — so a directory is recorded as a skill *and*
 * still descended into to find nested sub-skills. Returns sorted paths so a
 * parent sorts before its children.
 */
function collectSkillDirs(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (existsSync(join(dir, "SKILL.md"))) out.push(dir);
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
 *   1. `<dir>/SKILL.md` exists → that skill plus any nested sub-skills under it.
 *   2. `skills/<dir>/SKILL.md` exists (relative to cwd) → the `skills/`
 *      convention, so a bare skill name resolves without the redundant prefix.
 *      Namespaced names map `:` → `/` to match the nested on-disk folder
 *      (e.g. `skillship:author` → `skills/skillship/author`); the legacy flat
 *      `:` → `-` form is still accepted.
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
    dir.replaceAll(":", "/"),
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
