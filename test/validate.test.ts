import { describe, it, expect, afterEach, afterAll } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateCommand } from "../src/commands/validate.js";

const tmpDirs: string[] = [];
let prevCwd: string | undefined;

afterEach(() => {
  if (prevCwd) process.chdir(prevCwd);
  prevCwd = undefined;
});

afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true });
});

async function writeSkill(
  dir: string,
  name: string,
  description = "A valid skill used for validation tests.",
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\nBody.\n`,
  );
}

describe("validate (multi-skill)", () => {
  it("validates every skill under skills/, including flat sibling sub-skills", async () => {
    const work = await mkdtemp(join(tmpdir(), "skillship-val-"));
    tmpDirs.push(work);
    await writeSkill(join(work, "skills", "skillship"), "skillship");
    await writeSkill(join(work, "skills", "skillship-author"), "skillship-author");

    const code = await validateCommand(work, { profile: "all" });
    expect(code).toBe(0);
  });

  it("fails when any single skill is invalid", async () => {
    const work = await mkdtemp(join(tmpdir(), "skillship-val-"));
    tmpDirs.push(work);
    await writeSkill(join(work, "skills", "good"), "good");
    // Name does not match its folder -> fails every profile.
    await writeSkill(join(work, "skills", "bad"), "mismatch");

    const code = await validateCommand(work, { profile: "all" });
    expect(code).toBe(1);
  });

  it("validates a single skill by bare name via the skills/ convention", async () => {
    const work = await mkdtemp(join(tmpdir(), "skillship-val-"));
    tmpDirs.push(work);
    await writeSkill(join(work, "skills", "solo"), "solo");

    prevCwd = process.cwd();
    process.chdir(work);
    const code = await validateCommand("solo", { profile: "all" });
    expect(code).toBe(0);
  });

  it("returns 1 when no skill is found", async () => {
    const work = await mkdtemp(join(tmpdir(), "skillship-val-"));
    tmpDirs.push(work);
    const code = await validateCommand(work, { profile: "all" });
    expect(code).toBe(1);
  });
});
