import { describe, it, expect, afterAll, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkill } from "../src/lib/load.js";

const tmpDirs: string[] = [];
let prevCwd: string;

const SKILL = "---\nname: demo\ndescription: A demo skill.\n---\n# demo\n";

beforeEach(async () => {
  prevCwd = process.cwd();
  const work = await mkdtemp(join(tmpdir(), "skillship-load-"));
  tmpDirs.push(work);
  process.chdir(work);
});

afterEach(() => {
  process.chdir(prevCwd);
});

afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true });
});

describe("loadSkill", () => {
  it("resolves an explicit path containing SKILL.md", async () => {
    await mkdir("demo", { recursive: true });
    await writeFile(join("demo", "SKILL.md"), SKILL);
    const loaded = await loadSkill("demo");
    expect(loaded.dir).toBe(join(process.cwd(), "demo"));
  });

  it("resolves a bare name under skills/ by convention", async () => {
    await mkdir(join("skills", "demo"), { recursive: true });
    await writeFile(join("skills", "demo", "SKILL.md"), SKILL);
    const loaded = await loadSkill("demo");
    expect(loaded.dir).toBe(join(process.cwd(), "skills", "demo"));
  });

  it("resolves a namespaced name to its flat sibling folder (: -> -)", async () => {
    await mkdir(join("skills", "demo-sub"), { recursive: true });
    await writeFile(
      join("skills", "demo-sub", "SKILL.md"),
      "---\nname: demo:sub\ndescription: A demo sub skill.\n---\n# demo:sub\n",
    );
    const loaded = await loadSkill("demo:sub");
    expect(loaded.dir).toBe(join(process.cwd(), "skills", "demo-sub"));
  });

  it("prefers an explicit path over the skills/ fallback", async () => {
    await mkdir("demo", { recursive: true });
    await writeFile(join("demo", "SKILL.md"), SKILL);
    await mkdir(join("skills", "demo"), { recursive: true });
    await writeFile(join("skills", "demo", "SKILL.md"), SKILL);
    const loaded = await loadSkill("demo");
    expect(loaded.dir).toBe(join(process.cwd(), "demo"));
  });

  it("throws when neither location has a SKILL.md", async () => {
    await expect(loadSkill("nope")).rejects.toThrow(/No SKILL.md/);
  });
});
