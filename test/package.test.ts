import { describe, it, expect, afterAll } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yauzl from "yauzl";
import { packageCommand } from "../src/commands/package.js";

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

async function writeSkill(dir: string, name: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: A valid skill used for bundling tests.\n---\nBody.\n`,
  );
}

describe("package (bundle)", () => {
  it("bundles every skill under skills/ into one zip named by common prefix", async () => {
    const work = await mkdtemp(join(tmpdir(), "skillship-pkg-"));
    tmpDirs.push(work);
    await writeSkill(join(work, "skills", "skillship"), "skillship");
    await writeSkill(join(work, "skills", "skillship:author"), "skillship:author");
    await writeSkill(join(work, "skills", "skillship:install"), "skillship:install");

    const dist = join(work, "dist");
    const code = await packageCommand(work, { out: dist });
    expect(code).toBe(0);

    const outPath = join(dist, "skillship.skill");
    expect(existsSync(outPath)).toBe(true);

    const entries = await listEntries(outPath);
    // `:` is rewritten to `-` for portable, Windows-safe zip entries.
    expect(entries).toContain("skillship/SKILL.md");
    expect(entries).toContain("skillship-author/SKILL.md");
    expect(entries).toContain("skillship-install/SKILL.md");
    // No files at the zip root.
    for (const e of entries) expect(e.includes("/")).toBe(true);
  });

  it("uses the single skill's own name when only one skill exists", async () => {
    const work = await mkdtemp(join(tmpdir(), "skillship-pkg-"));
    tmpDirs.push(work);
    await writeSkill(join(work, "skills", "solo"), "solo");

    const dist = join(work, "dist");
    const code = await packageCommand(work, { out: dist });
    expect(code).toBe(0);
    expect(existsSync(join(dist, "solo.skill"))).toBe(true);
  });
});
