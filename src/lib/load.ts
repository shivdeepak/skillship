import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseSkill, type ParsedSkill } from "./frontmatter.js";

export interface LoadedSkill {
  dir: string;
  skillMdPath: string;
  parsed: ParsedSkill;
}

/** Resolve a skill directory and load its SKILL.md. Throws on missing file. */
export async function loadSkill(dir: string): Promise<LoadedSkill> {
  const abs = resolve(dir);
  const skillMdPath = join(abs, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    throw new Error(`No SKILL.md found in ${abs}`);
  }
  const content = await readFile(skillMdPath, "utf8");
  return { dir: abs, skillMdPath, parsed: parseSkill(content) };
}
