import { describe, it, expect, afterAll } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yauzl from "yauzl";
import { packSkill } from "../src/lib/zip.js";

const here = dirname(fileURLToPath(import.meta.url));
const tmpDirs: string[] = [];

afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true });
});

function listEntries(zipPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const entries: string[] = [];
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err);
      zip.on("entry", (entry) => {
        entries.push(entry.fileName);
        zip.readEntry();
      });
      zip.on("end", () => resolve(entries));
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}

describe("packSkill", () => {
  it("creates a zip rooted at <name>/ and excludes junk", async () => {
    const work = await mkdtemp(join(tmpdir(), "skillship-"));
    tmpDirs.push(work);
    const skillDir = join(work, "demo");
    await mkdir(join(skillDir, "snippets"), { recursive: true });
    await mkdir(join(skillDir, "node_modules"), { recursive: true });
    await mkdir(join(skillDir, "__pycache__"), { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), "---\nname: demo\n---\n");
    await writeFile(join(skillDir, "snippets", "a.md"), "a");
    await writeFile(join(skillDir, ".DS_Store"), "junk");
    await writeFile(join(skillDir, "node_modules", "x.js"), "junk");
    await writeFile(join(skillDir, "__pycache__", "y.pyc"), "junk");

    const out = await packSkill({
      skillDir,
      name: "demo",
      outDir: join(work, "dist"),
    });
    const entries = await listEntries(out);

    expect(entries).toContain("demo/SKILL.md");
    expect(entries).toContain("demo/snippets/a.md");
    for (const e of entries) {
      expect(e.split("/")[0]).toBe("demo");
    }
    expect(entries.some((e) => e.includes(".DS_Store"))).toBe(false);
    expect(entries.some((e) => e.includes("node_modules"))).toBe(false);
    expect(entries.some((e) => e.includes("__pycache__"))).toBe(false);
  });
});
