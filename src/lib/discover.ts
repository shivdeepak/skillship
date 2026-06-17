import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Discover skill directories to operate on, given a project/skill root.
 *
 * Resolution order:
 *   1. `<dir>/SKILL.md` exists → the dir itself is a single skill.
 *   2. `skills/<dir>/SKILL.md` exists (relative to cwd) → the `skills/`
 *      convention, so a bare skill name resolves without the redundant prefix.
 *      Namespaced names map `:` → `-` to match the on-disk folder
 *      (e.g. `skillship:author` → `skills/skillship-author`).
 *   3. `<dir>/skills/` exists → every immediate subdir with a `SKILL.md`.
 *   4. otherwise → every immediate subdir of `<dir>` with a `SKILL.md`.
 *
 * Returns absolute, sorted skill directory paths (empty when none found).
 */
export function discoverSkillDirs(dir: string): string[] {
  const abs = resolve(dir);
  if (existsSync(join(abs, "SKILL.md"))) return [abs];

  for (const candidate of new Set([dir, dir.replaceAll(":", "-")])) {
    const underSkills = resolve(process.cwd(), "skills", candidate);
    if (existsSync(join(underSkills, "SKILL.md"))) return [underSkills];
  }

  const skillsRoot = existsSync(join(abs, "skills")) ? join(abs, "skills") : abs;

  let entries: string[];
  try {
    entries = readdirSync(skillsRoot);
  } catch {
    return [];
  }

  return entries
    .map((entry) => join(skillsRoot, entry))
    .filter((path) => {
      try {
        return statSync(path).isDirectory() && existsSync(join(path, "SKILL.md"));
      } catch {
        return false;
      }
    })
    .sort();
}
