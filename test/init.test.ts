import { describe, it, expect, afterAll, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initCommand } from "../src/commands/init.js";

const tmpDirs: string[] = [];
let prevCwd: string;

beforeEach(async () => {
  prevCwd = process.cwd();
  const work = await mkdtemp(join(tmpdir(), "skillship-init-"));
  tmpDirs.push(work);
  process.chdir(work);
});

afterEach(() => {
  process.chdir(prevCwd);
});

afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true });
});

describe("init", () => {
  it("scaffolds all files with the name substituted", async () => {
    const code = await initCommand("demo", { ci: true, snippets: true });
    expect(code).toBe(0);

    const root = join(process.cwd(), "demo");
    const expectedFiles = [
      "demo/SKILL.md",
      "README.md",
      "AGENTS.md",
      "release-please-config.json",
      ".release-please-manifest.json",
      "version.txt",
      ".github/workflows/validate.yml",
      ".github/workflows/release.yml",
      "snippets/cursor-rule.mdc",
      "snippets/claude-md.md",
    ];
    for (const f of expectedFiles) {
      expect(existsSync(join(root, f)), `missing ${f}`).toBe(true);
    }

    const skillMd = await readFile(join(root, "demo", "SKILL.md"), "utf8");
    expect(skillMd).toContain("name: demo");
    expect(skillMd).toContain("x-release-please-version");

    const cfg = JSON.parse(
      await readFile(join(root, "release-please-config.json"), "utf8"),
    );
    expect(cfg.packages["."]["extra-files"][0].path).toBe("demo/SKILL.md");

    const manifest = JSON.parse(
      await readFile(join(root, ".release-please-manifest.json"), "utf8"),
    );
    expect(manifest["."]).toBe("1.0.0");

    const validateYml = await readFile(
      join(root, ".github/workflows/validate.yml"),
      "utf8",
    );
    expect(validateYml).toContain("npx skillship validate demo");
  });

  it("omits CI and snippets when flags are off", async () => {
    const code = await initCommand("plain", {});
    expect(code).toBe(0);
    const root = join(process.cwd(), "plain");
    expect(existsSync(join(root, ".github"))).toBe(false);
    expect(existsSync(join(root, "snippets"))).toBe(false);
    expect(existsSync(join(root, "plain", "SKILL.md"))).toBe(true);
  });
});
