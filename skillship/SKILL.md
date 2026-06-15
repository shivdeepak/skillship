---
name: skillship
description: Turn a project into a publishable Agent Skill via the skillship CLI. Use to scaffold, validate, package, install, or publish a SKILL.md for Cursor, Claude Code, Claude Web, or Cowork, or on /skillship
---

# skillship

Drive the `skillship` CLI to convert the user's project into a portable Agent
Skill and publish it. Run the CLI for the user; do not ask them to run commands
manually.

## Workflow

Copy this checklist and track progress:

```
- [ ] 1. Locate or create the SKILL.md
- [ ] 2. Validate (skillship validate)
- [ ] 3. Fix any reported issues, re-validate until clean
- [ ] 4. Confirm publish target with the user
- [ ] 5. Install (filesystem) or package (Claude upload)
```

### Step 1 — Locate or create the SKILL.md

A skill is a directory containing a `SKILL.md`. Find one in the project (search
for `SKILL.md`). Determine `<dir>` = the folder that directly contains it.

- **Already exists** → use it.
- **Does not exist** → scaffold one:

```bash
npx skillship init <name> --ci --snippets
```

Then author the `SKILL.md` body following the `create-skill` skill's rules
(third-person `description`, both WHAT and WHEN, under 500 lines). The skill
`name` must be lowercase letters/numbers/hyphens and match the parent folder.

### Step 2 — Validate

```bash
npx skillship validate <dir> --profile all
```

`--profile all` is the strictest (Claude's 200-char description cap). Use
`--json` if you need to parse results programmatically.

### Step 3 — Fix and re-validate

Read each failure, edit the `SKILL.md`, and re-run validate until it exits 0.
Common failures: description over 200 chars, `name` not matching the folder,
`<`/`>` characters in the description, body over 500 lines (warning only).

### Step 4 — Confirm the publish target

Ask the user where to publish (use AskQuestion). Targets:

| Target | Mechanism |
| --- | --- |
| `cursor`, `claude-code` | Filesystem install |
| `claude-web`, `claude-cowork` | Upload-only `.skill` zip |

### Step 5 — Install or package

**Filesystem agents** (e.g. Cursor, Claude Code) — install with the `npx skills`
convention that skillship wraps:

```bash
# Local directory
npx skillship install <dir> -a cursor,claude-code

# Remote — GitHub shorthand, GitLab URL, SSH URL, or any git-clonable ref
npx skillship install owner/repo -a cursor,claude-code
npx skillship install owner/repo@skill-name          # filter by skill name
npx skillship install https://gitlab.com/org/repo/-/tree/main/skills/my-skill
npx skillship install git@github.com:org/repo.git
```

Remote sources are cloned (`git clone --depth 1`) to a temp directory; `git`
must be on PATH. Add `--global` to install for all projects, `--copy` to copy
instead of symlink.

**Upload-only surfaces** (e.g. Claude Web / Cowork):

```bash
npx skillship package <dir>        # -> dist/<name>.skill
```

Then tell the user to upload `dist/<name>.skill`:
- Claude Web: Settings → Capabilities → Upload skill → enable toggle.
- Claude Cowork: Customize → Skills → Upload (desktop app only).

## Publishing via CI (optional)

If the skill repo was created with `init --ci`, it auto-releases via
release-please + Conventional Commits. After pushing, tell the user to enable
**Settings → Actions → Workflow permissions**: "Read and write" and "Allow
GitHub Actions to create and approve pull requests" so release-please can open
release PRs and attach the `.skill` asset.

## Invoking the CLI

Prefer `npx skillship <command>`. If `npx skillship` cannot resolve the package
(not published / offline), run it from a local checkout instead:

```bash
npm run build            # in the skillship repo, produces dist/cli.js
node dist/cli.js <command>
```

Run `npx skillship doctor` to verify the environment (Node >= 18, npx; optional
gh and agentskills).
