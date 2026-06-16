import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { isAvailable, run } from "./exec.js";
import { parseSkill } from "./frontmatter.js";

export interface ParsedRemoteRef {
  cloneUrl: string;
  /** Relative subpath within the cloned repo to start the skill search from. */
  subpath?: string;
  /** `owner/repo@skill-name` — match SKILL.md by name field. */
  skillFilter?: string;
}

/**
 * Returns true when `ref` should be treated as a remote source rather than a
 * local filesystem path.
 *
 * Local indicators (treated as local, no change to existing behaviour):
 *   - starts with `.`  (`./foo`, `../bar`, `.`)
 *   - starts with `/`  (Unix absolute)
 *   - starts with `~`  (home-dir shorthand)
 *   - starts with a Windows drive letter (`C:\`)
 *   - the path already exists on disk
 */
export function isRemoteRef(ref: string): boolean {
  if (
    ref.startsWith(".") ||
    ref.startsWith("/") ||
    ref.startsWith("~") ||
    /^[A-Za-z]:[/\\]/.test(ref)
  ) {
    return false;
  }
  // If the path exists on disk, treat it as local.
  if (existsSync(ref)) return false;
  return true;
}

/**
 * Parse any `npx skills add`-compatible remote ref into a git-clone URL plus
 * an optional subpath inside the cloned repo and an optional skill-name filter.
 *
 * Supported formats:
 *   owner/repo                           → github.com/owner/repo
 *   owner/repo@skill-name                → github.com/owner/repo  (filter by name)
 *   owner/repo/sub/path                  → github.com/owner/repo  (subpath)
 *   https://github.com/o/r              → clone directly
 *   https://github.com/o/r/tree/br/path → clone o/r, subpath = path
 *   https://gitlab.com/o/r/-/tree/br/p  → clone o/r, subpath = p
 *   git@host:o/r.git                    → clone directly
 *   any other http(s)/git URL           → clone directly
 */
export function parseRemoteRef(ref: string): ParsedRemoteRef {
  // --- Full URL forms ---
  if (ref.startsWith("https://") || ref.startsWith("http://")) {
    const url = new URL(ref);
    const host = url.hostname;

    if (host === "github.com") {
      // https://github.com/owner/repo[/tree/branch[/subpath...]]
      const parts = url.pathname.replace(/^\//, "").split("/");
      // parts: [owner, repo, "tree", branch, ...subpaths]
      if (parts.length >= 4 && parts[2] === "tree") {
        const cloneUrl = `https://github.com/${parts[0]}/${parts[1]}`;
        const subpath = parts.slice(4).join("/") || undefined;
        return { cloneUrl, subpath };
      }
      // https://github.com/owner/repo
      const cloneUrl = `https://github.com/${parts[0]}/${parts[1]}`;
      return { cloneUrl };
    }

    if (host === "gitlab.com") {
      // https://gitlab.com/org/repo[/-/tree/branch[/subpath...]]
      const raw = url.pathname.replace(/^\//, "");
      const treeIdx = raw.indexOf("/-/tree/");
      if (treeIdx !== -1) {
        const repoPath = raw.slice(0, treeIdx); // e.g. "org/repo" or "group/sub/repo"
        const cloneUrl = `https://gitlab.com/${repoPath}`;
        const afterTree = raw.slice(treeIdx + "/-/tree/".length);
        // afterTree = "branch/subpath..." — skip branch segment
        const afterBranch = afterTree.split("/").slice(1).join("/");
        const subpath = afterBranch || undefined;
        return { cloneUrl, subpath };
      }
      // https://gitlab.com/org/repo (no tree)
      return { cloneUrl: `https://gitlab.com/${raw}` };
    }

    // Any other https/http URL — clone directly (well-known endpoint, GHE, etc.)
    return { cloneUrl: ref };
  }

  // --- SSH git URL: git@host:org/repo.git ---
  if (ref.startsWith("git@") || ref.endsWith(".git")) {
    return { cloneUrl: ref };
  }

  // --- GitHub shorthand: owner/repo[@skill-name][/sub/path] ---
  // Strip leading https?:// in case someone passes a bare github.com URL without protocol
  const bare = ref.replace(/^(https?:\/\/)?(www\.)?/, "");
  if (bare.startsWith("github.com/") || bare.startsWith("gitlab.com/")) {
    return parseRemoteRef("https://" + bare);
  }

  // owner/repo@skill-name
  const atIdx = ref.indexOf("@");
  if (atIdx !== -1) {
    const repoSlug = ref.slice(0, atIdx);
    const skillFilter = ref.slice(atIdx + 1);
    const [owner, repo] = repoSlug.split("/");
    return {
      cloneUrl: `https://github.com/${owner}/${repo}`,
      skillFilter: skillFilter || undefined,
    };
  }

  // owner/repo[/sub/path]
  const slashIdx = ref.indexOf("/");
  if (slashIdx !== -1) {
    const secondSlash = ref.indexOf("/", slashIdx + 1);
    if (secondSlash === -1) {
      // plain owner/repo
      return { cloneUrl: `https://github.com/${ref}` };
    }
    // owner/repo/sub/path
    const owner = ref.slice(0, slashIdx);
    const repo = ref.slice(slashIdx + 1, secondSlash);
    const subpath = ref.slice(secondSlash + 1);
    return {
      cloneUrl: `https://github.com/${owner}/${repo}`,
      subpath: subpath || undefined,
    };
  }

  // Fallback: treat as direct clone URL
  return { cloneUrl: ref };
}

/**
 * Clone the remote skill to a temp directory and return the path to the local
 * skill directory (the one that contains SKILL.md).
 *
 * The returned `cleanup()` deletes the temp dir; call it in a `finally` block.
 */
export async function fetchRemoteSkill(
  ref: string,
): Promise<{ localDir: string; cleanup: () => void }> {
  if (!isAvailable("git")) {
    throw new Error(
      "`git` not found on PATH. Install git to use remote skill sources.",
    );
  }

  const { cloneUrl, subpath, skillFilter } = parseRemoteRef(ref);

  // Derive a safe folder name from the clone URL for use inside the temp dir.
  const repoName = basename(cloneUrl.replace(/\.git$/, ""));
  const tmp = mkdtempSync(join(tmpdir(), "skillship-"));
  const cloneTarget = join(tmp, repoName);
  const cleanup = (): void => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  };

  try {
    const code = await run("git", [
      "clone",
      "--depth",
      "1",
      "--quiet",
      cloneUrl,
      cloneTarget,
    ]);
    if (code !== 0) {
      throw new Error(`git clone failed (exit ${code}): ${cloneUrl}`);
    }

    const localDir = await resolveSkillDir(
      cloneTarget,
      repoName,
      subpath,
      skillFilter,
    );
    return { localDir, cleanup };
  } catch (err) {
    cleanup();
    throw err;
  }
}

/**
 * Walk the cloned repo to find the skill directory to install.
 *
 * Resolution order:
 *  1. If `subpath` given → `<clone>/<subpath>` (must contain SKILL.md)
 *  2. If `skillFilter` given → walk tree for SKILL.md whose `name` field matches
 *  3. Standard convention → `<clone>/skills/<repoName>/SKILL.md`
 *  4. Fallback → `<clone>/SKILL.md`
 */
async function resolveSkillDir(
  cloneDir: string,
  repoName: string,
  subpath?: string,
  skillFilter?: string,
): Promise<string> {
  if (subpath) {
    const candidate = join(cloneDir, subpath);
    if (!existsSync(join(candidate, "SKILL.md"))) {
      throw new Error(
        `No SKILL.md found at subpath "${subpath}" in cloned repo.`,
      );
    }
    return candidate;
  }

  if (skillFilter) {
    const match = await findSkillByName(cloneDir, skillFilter);
    if (!match) {
      throw new Error(
        `No SKILL.md with name "${skillFilter}" found in cloned repo.`,
      );
    }
    return match;
  }

  // Conventional: <clone>/skills/<repoName>/SKILL.md
  const conventional = join(cloneDir, "skills", repoName);
  if (existsSync(join(conventional, "SKILL.md"))) return conventional;

  // Root-level fallback: <clone>/SKILL.md
  if (existsSync(join(cloneDir, "SKILL.md"))) return cloneDir;

  throw new Error(
    `No SKILL.md found in cloned repo. Expected it at "skills/${repoName}/SKILL.md" or root.`,
  );
}

/** Recursively walk `dir` for SKILL.md files and return the dir whose `name` matches. */
async function findSkillByName(
  dir: string,
  skillFilter: string,
): Promise<string | undefined> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return undefined;
  }

  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      const skillMd = join(full, "SKILL.md");
      if (existsSync(skillMd)) {
        try {
          const content = await readFile(skillMd, "utf8");
          const parsed = parseSkill(content);
          if (parsed.frontmatter.name === skillFilter) return full;
        } catch {
          // unparseable, skip
        }
      }
      const nested = await findSkillByName(full, skillFilter);
      if (nested) return nested;
    }
  }
  return undefined;
}
