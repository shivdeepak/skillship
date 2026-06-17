import { describe, it, expect, vi, afterAll } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { runMock } = vi.hoisted(() => ({ runMock: vi.fn(async () => 0) }));

vi.mock("../src/lib/exec.js", async () => {
  const actual =
    await vi.importActual<typeof import("../src/lib/exec.js")>(
      "../src/lib/exec.js",
    );
  return { ...actual, run: runMock, isAvailable: () => true };
});

import { buildSkillsAddArgv } from "../src/lib/exec.js";
import { installCommand } from "../src/commands/install.js";

const tmpDirs: string[] = [];

afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true });
});

async function writeSkill(dir: string, name: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: A valid skill used for install tests.\n---\nBody.\n`,
  );
}

describe("install (local multi-skill)", () => {
  it("installs every sibling skill discovered under a local project root", async () => {
    runMock.mockClear();
    const work = await mkdtemp(join(tmpdir(), "skillship-inst-"));
    tmpDirs.push(work);
    await writeSkill(join(work, "skills", "skillship"), "skillship");
    await writeSkill(join(work, "skills", "skillship-author"), "skillship-author");
    await writeSkill(join(work, "skills", "skillship-install"), "skillship-install");

    const code = await installCommand(work, { agent: "claude-code" });
    expect(code).toBe(0);
    expect(runMock).toHaveBeenCalledTimes(3);

    const installedDirs = runMock.mock.calls.map((c) => (c[1] as string[])[2]);
    expect(installedDirs).toContain(join(work, "skills", "skillship"));
    expect(installedDirs).toContain(join(work, "skills", "skillship-author"));
    expect(installedDirs).toContain(join(work, "skills", "skillship-install"));
  });
});

describe("buildSkillsAddArgv", () => {
  it("builds default argv", () => {
    expect(
      buildSkillsAddArgv({ dir: "/x/demo", agents: ["cursor", "claude-code"] }),
    ).toEqual([
      "skills",
      "add",
      "/x/demo",
      "-a",
      "cursor",
      "-a",
      "claude-code",
    ]);
  });

  it("maps --global and --copy flags", () => {
    expect(
      buildSkillsAddArgv({
        dir: "/x/demo",
        agents: ["cursor"],
        global: true,
        copy: true,
      }),
    ).toEqual([
      "skills",
      "add",
      "/x/demo",
      "--global",
      "--copy",
      "-a",
      "cursor",
    ]);
  });

  it("omits -a when no agents", () => {
    expect(buildSkillsAddArgv({ dir: "/x/demo", agents: [] })).toEqual([
      "skills",
      "add",
      "/x/demo",
    ]);
  });
});
