import { describe, it, expect } from "vitest";
import { buildSkillsAddArgv } from "../src/lib/exec.js";

describe("buildSkillsAddArgv", () => {
  it("builds default argv", () => {
    expect(
      buildSkillsAddArgv({ dir: "/x/demo", agents: ["cursor", "claude-code"] }),
    ).toEqual(["skills", "add", "/x/demo", "-a", "cursor,claude-code"]);
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
