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

async function collectFiles(
  root: string,
  prune: Set<string>,
): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        // Skip directories that are themselves a separate skill in the bundle;
        // their files are emitted under their own (nested) folder instead of
        // being duplicated inside the parent skill.
        if (prune.has(full)) continue;
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
 * Folder path a skill occupies inside the zip. The `:` namespace separator
 * maps to a nested folder, so `skillship:author` is stored under
 * `skillship/author/` — directly inside its parent skill's `skillship/` folder.
 */
function zipFolder(name: string): string {
  return name.replace(/:/g, "/");
}

/**
 * Filename-safe form of a name for the output `.skill` file. `:` and `/` are
 * not portable in filenames (and `archiver` treats a leading `prefix:` as a
 * drive), so both are rewritten to `-` (e.g. `skillship:author` →
 * `skillship-author.skill`).
 */
function fileSafeName(name: string): string {
  return name.replace(/[:/]/g, "-");
}

/**
 * Create a single `.skill` zip containing one or more skills. Each skill's
 * files are placed under its `<skill.name>/` folder (with `:` mapped to `/`, so
 * sub-skills nest inside their parent), and nested sub-skills are pruned from
 * their parent's file walk to avoid duplicate entries. The archive never has
 * files at the root. Returns the output path.
 */
export async function packSkills(opts: {
  skills: BundleSkill[];
  bundleName: string;
  outDir: string;
}): Promise<string> {
  const { skills, bundleName, outDir } = opts;
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${fileSafeName(bundleName)}.skill`);

  const skillDirs = new Set(skills.map((s) => s.dir));
  const entries: Array<{ file: string; name: string }> = [];
  const folders = new Map<string, string>();
  for (const skill of skills) {
    const folder = zipFolder(skill.name);
    const prior = folders.get(folder);
    if (prior && prior !== skill.name) {
      throw new Error(
        `Skill names "${prior}" and "${skill.name}" both map to zip folder "${folder}". Rename one to avoid the collision.`,
      );
    }
    folders.set(folder, skill.name);

    const prune = new Set(
      [...skillDirs].filter((d) => d !== skill.dir),
    );
    const files = await collectFiles(skill.dir, prune);
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
