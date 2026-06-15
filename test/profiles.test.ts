import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { parseSkill } from "../src/lib/frontmatter.js";
import {
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
