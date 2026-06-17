import { createWriteStream } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import archiver from "archiver";

const EXCLUDED_DIRS = new Set([
  "__pycache__",
  "node_modules",
  "dist",
  ".git",
]);
const EXCLUDED_FILES = new Set([".DS_Store"]);

async function collectFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        if (EXCLUDED_FILES.has(entry.name)) continue;
        out.push(full);
      }
    }
  }
  await walk(root);
  return out.sort();
}

export interface BundleSkill {
  /** Absolute path to the skill directory containing SKILL.md. */
  dir: string;
  /** Skill name; becomes the entry's top-level folder inside the zip. */
  name: string;
}

/**
 * Make a skill name safe to use as a zip entry / output filename. `:` is
 * illegal in filenames on Windows, and `archiver` strips a leading
 * `prefix:` (treating it as a drive), so namespaced names like
 * `skillship:author` are rewritten to `skillship-author`.
 */
function safeName(name: string): string {
  return name.replace(/:/g, "-");
}

/**
 * Create a single `.skill` zip containing one or more skills. Each skill's
 * files are placed under a `<skill.name>/` folder at the zip root (with `:`
 * rewritten to `-`), so the archive never has files at the root. Returns the
 * output path.
 */
export async function packSkills(opts: {
  skills: BundleSkill[];
  bundleName: string;
  outDir: string;
}): Promise<string> {
  const { skills, bundleName, outDir } = opts;
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${safeName(bundleName)}.skill`);

  const entries: Array<{ file: string; name: string }> = [];
  const folders = new Map<string, string>();
  for (const skill of skills) {
    const folder = safeName(skill.name);
    const prior = folders.get(folder);
    if (prior && prior !== skill.name) {
      throw new Error(
        `Skill names "${prior}" and "${skill.name}" both map to zip folder "${folder}". Rename one to avoid the collision.`,
      );
    }
    folders.set(folder, skill.name);

    const files = await collectFiles(skill.dir);
    for (const file of files) {
      const rel = relative(skill.dir, file);
      entries.push({ file, name: `${folder}/${rel}` });
    }
  }

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    for (const entry of entries) {
      archive.file(entry.file, { name: entry.name });
    }
    void archive.finalize();
  });

  return outPath;
}

/**
 * Pack a single skill into `<name>.skill` whose archive root is `<name>/`.
 * Thin wrapper over `packSkills` for the single-skill case.
 */
export async function packSkill(opts: {
  skillDir: string;
  name: string;
  outDir: string;
}): Promise<string> {
  return packSkills({
    skills: [{ dir: opts.skillDir, name: opts.name }],
    bundleName: opts.name,
    outDir: opts.outDir,
  });
}
