import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { parseSkill } from "../src/lib/frontmatter.js";
import {
  NAME_RE,
  validateProfile,
  type ProfileName,
} from "../src/lib/profiles.js";

const here = dirname(fileURLToPath(import.meta.url));

function validate(fixture: string, profile: ProfileName): boolean {
  const dir = join(here, "fixtures", fixture);
  const content = readFileSync(join(dir, "SKILL.md"), "utf8");
  return validateProfile(parseSkill(content), dir, profile).ok;
}

type Expectations = Record<string, Record<ProfileName, boolean>>;

const expectations: Expectations = {
  "valid-skill": {
    spec: true,
    cursor: true,
    "claude-web": true,
    "claude-cowork": true,
    all: true,
  },
  "long-description": {
    spec: true,
    cursor: true,
    "claude-web": false,
    "claude-cowork": false,
    all: false,
  },
  "name-mismatch": {
    spec: false,
    cursor: false,
    "claude-web": false,
    "claude-cowork": false,
    all: false,
  },
  "block-scalar": {
    spec: true,
    cursor: true,
    "claude-web": true,
    "claude-cowork": true,
    all: true,
  },
};

describe("validation profiles", () => {
  for (const [fixture, perProfile] of Object.entries(expectations)) {
    for (const [profile, expected] of Object.entries(perProfile)) {
      it(`${fixture} on ${profile} => ${expected ? "pass" : "fail"}`, () => {
        expect(validate(fixture, profile as ProfileName)).toBe(expected);
      });
    }
  }
});

describe("namespaced skill names", () => {
  it("NAME_RE accepts colon-namespaced names and rejects malformed ones", () => {
    expect(NAME_RE.test("skillship")).toBe(true);
    expect(NAME_RE.test("skillship:author")).toBe(true);
    expect(NAME_RE.test("my-skill:sub-task")).toBe(true);
    expect(NAME_RE.test(":bad")).toBe(false);
    expect(NAME_RE.test("bad:")).toBe(false);
    expect(NAME_RE.test("Bad:Name")).toBe(false);
  });

  it("passes the name check when a flat sibling folder matches a namespaced name", () => {
    const parsed = parseSkill(
      "---\nname: skillship:author\ndescription: A valid namespaced skill.\n---\nBody.",
    );
    // `:` maps to `-`: skillship:author lives in a flat skillship-author/ folder.
    expect(validateProfile(parsed, "/tmp/skills/skillship-author", "all").ok).toBe(true);
    // A folder named for the literal name also passes.
    expect(validateProfile(parsed, "/tmp/skillship:author", "all").ok).toBe(true);
  });

  it("fails the name check when the folder does not match the name", () => {
    const parsed = parseSkill(
      "---\nname: skillship:author\ndescription: A valid namespaced skill.\n---\nBody.",
    );
    // The old nested layout no longer matches a flat-sibling name.
    expect(validateProfile(parsed, "/tmp/skills/skillship/author", "all").ok).toBe(false);
    expect(validateProfile(parsed, "/tmp/skills/other", "all").ok).toBe(false);
  });
});
