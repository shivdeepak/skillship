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

/**
 * Create a `.skill` zip whose archive root is the skill folder, i.e. every
 * entry is prefixed with `<name>/`. Returns the output path.
 */
export async function packSkill(opts: {
  skillDir: string;
  name: string;
  outDir: string;
}): Promise<string> {
  const { skillDir, name, outDir } = opts;
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${name}.skill`);

  const files = await collectFiles(skillDir);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    for (const file of files) {
      const rel = relative(skillDir, file);
      archive.file(file, { name: `${name}/${rel}` });
    }
    void archive.finalize();
  });

  return outPath;
}
