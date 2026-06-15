import { describe, it, expect } from "vitest";
import { parseSkill } from "../src/lib/frontmatter.js";

describe("frontmatter parser", () => {
  it("parses simple scalars and strips trailing comments", () => {
    const { frontmatter } = parseSkill(
      [
        "---",
        "name: foo",
        'metadata:',
        '  version: "1.0.0" # x-release-please-version',
        "---",
        "# body",
      ].join("\n"),
    );
    expect(frontmatter.name).toBe("foo");
    expect((frontmatter.metadata as Record<string, string>).version).toBe(
      "1.0.0",
    );
  });

  it("handles folded block scalar without mis-joining the next key", () => {
    const { frontmatter } = parseSkill(
      [
        "---",
        "name: bar",
        "description: >-",
        "  line one continues",
        "  into line two.",
        "license: MIT",
        "---",
        "# body",
      ].join("\n"),
    );
    expect(frontmatter.description).toBe("line one continues into line two.");
    expect(frontmatter.license).toBe("MIT");
    expect(frontmatter.description).not.toContain("MIT");
  });

  it("handles literal block scalar", () => {
    const { frontmatter } = parseSkill(
      [
        "---",
        "name: baz",
        "description: |",
        "  first",
        "  second",
        "---",
      ].join("\n"),
    );
    expect(frontmatter.description).toBe("first\nsecond");
  });

  it("parses nested metadata map", () => {
    const { frontmatter } = parseSkill(
      [
        "---",
        "name: qux",
        "metadata:",
        "  version: 2.0.0",
        "  author: me",
        "license: MIT",
        "---",
      ].join("\n"),
    );
    const md = frontmatter.metadata as Record<string, string>;
    expect(md.version).toBe("2.0.0");
    expect(md.author).toBe("me");
    expect(frontmatter.license).toBe("MIT");
  });

  it("separates body from frontmatter", () => {
    const { body } = parseSkill("---\nname: x\n---\n# Heading\ntext");
    expect(body).toContain("# Heading");
    expect(body).not.toContain("name: x");
  });
});
