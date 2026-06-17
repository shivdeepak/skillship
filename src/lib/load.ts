import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseSkill, type ParsedSkill } from "./frontmatter.js";

export interface LoadedSkill {
  dir: string;
  skillMdPath: string;
  parsed: ParsedSkill;
}

/**
 * Resolve a skill directory and load its SKILL.md. Throws on missing file.
 *
 * `dir` may be an explicit path (`.`, `./foo`, `skills/foo`) or, by convention,
 * a bare skill name. Resolution order:
 *   1. `<dir>/SKILL.md` — explicit path wins.
 *   2. `skills/<dir>/SKILL.md` — the `skills/` convention, so callers can pass a
 *      bare name without the redundant prefix. Namespaced names map `:` → `-`
 *      for the flat sibling folder (e.g. `skillship:author` →
 *      `skills/skillship-author`).
 */
export async function loadSkill(dir: string): Promise<LoadedSkill> {
  const abs = resolve(dir);

  let resolvedDir = existsSync(join(abs, "SKILL.md")) ? abs : undefined;
  if (!resolvedDir) {
    for (const candidate of new Set([
      dir,
      dir.replaceAll(":", "-"),
    ])) {
      const underSkills = resolve(process.cwd(), "skills", candidate);
      if (existsSync(join(underSkills, "SKILL.md"))) {
        resolvedDir = underSkills;
        break;
      }
    }
  }

  if (!resolvedDir) {
    throw new Error(
      `No SKILL.md found in ${abs} or under ${resolve(process.cwd(), "skills")}/`,
    );
  }

  const skillMdPath = join(resolvedDir, "SKILL.md");
  const content = await readFile(skillMdPath, "utf8");
  return { dir: resolvedDir, skillMdPath, parsed: parseSkill(content) };
}
