import { basename, join, resolve } from "node:path";
import { loadSkill } from "../lib/load.js";
import { discoverSkillDirs } from "../lib/discover.js";
import { validateProfile } from "../lib/profiles.js";
import { packSkills, type BundleSkill } from "../lib/zip.js";

export interface PackageOptions {
  out?: string;
}

/**
 * Pick the bundle name from the skill names:
 *   - one skill        → that skill's name
 *   - many skills      → their longest common prefix, trimmed of a trailing
 *                        `-`/`:` separator (e.g. `skillship:author` +
 *                        `skillship:install` → `skillship`)
 *   - no common prefix → `fallback` (the project folder name)
 */
function bundleName(names: string[], fallback: string): string {
  if (names.length === 1) return names[0];

  let prefix = names[0] ?? "";
  for (const name of names.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < name.length && prefix[i] === name[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }

  prefix = prefix.replace(/[-:]+$/, "");
  return prefix || fallback;
}

export async function packageCommand(
  dir: string,
  options: PackageOptions,
): Promise<number> {
  const root = resolve(dir);
  const skillDirs = discoverSkillDirs(root);

  if (skillDirs.length === 0) {
    process.stderr.write(
      `Error: no SKILL.md found in ${root} or ${join(root, "skills")}.\n`,
    );
    return 1;
  }

  const skills: BundleSkill[] = [];
  for (const skillDir of skillDirs) {
    let loaded;
    try {
      loaded = await loadSkill(skillDir);
    } catch (err) {
      process.stderr.write(
        `Error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return 1;
    }

    const result = validateProfile(loaded.parsed, loaded.dir, "all");
    if (!result.ok) {
      process.stderr.write(
        `Cannot package: validation failed for "${basename(loaded.dir)}" (--profile all).\n`,
      );
      for (const f of result.findings.filter((x) => x.severity === "error")) {
        process.stderr.write(`  ✗ ${f.check}: ${f.message}\n`);
      }
      process.stderr.write("\nRun `skillship validate` for details.\n");
      return 1;
    }

    skills.push({
      dir: loaded.dir,
      name: String(loaded.parsed.frontmatter.name),
    });
  }

  const name = bundleName(
    skills.map((s) => s.name),
    basename(root),
  );
  const outDir = options.out ?? join(process.cwd(), "dist");
  const outPath = await packSkills({ skills, bundleName: name, outDir });
  process.stdout.write(`Packaged ${skills.length} skill(s) -> ${outPath}\n`);
  return 0;
}
