---
name: skillship:install
description: Install a remote Agent Skill via the skillship CLI. Use when installing a skill from a GitHub repo, GitLab URL, or SSH URL into Cursor, Claude Code, or Claude Web.
---

# skillship:install

Drive the `skillship install` CLI command to install a remote Agent Skill. Run
the CLI for the user; do not ask them to run commands manually.

## Workflow

Copy this checklist and track progress:

```
- [ ] 1. Identify the skill source (repo URL, GitHub shorthand, or local path)
- [ ] 2. Confirm the install target with the user
- [ ] 3. Install or package for upload
```

### Step 1 — Identify the skill source

Determine where the skill lives. Accepted formats:

```bash
owner/repo                          # GitHub shorthand
owner/repo@skill-name               # filter to a specific skill by name
https://gitlab.com/org/repo/-/tree/main/skills/my-skill
git@github.com:org/repo.git
/local/path/to/skill-dir            # local directory
```

Remote sources are cloned (`git clone --depth 1`) to a temp directory; `git`
must be on PATH.

### Step 2 — Confirm the install target

Ask the user where to install (use AskQuestion). Targets:

| Target | Mechanism |
| --- | --- |
| `cursor`, `claude-code` | Filesystem install |
| `claude-web`, `claude-cowork` | Upload-only `.skill` zip |

### Step 3 — Install or package for upload

**Filesystem agents** (e.g. Cursor, Claude Code):

```bash
npx skillship install <source> -a cursor -a claude-code
```

- `--global` installs for all projects instead of the current one.
- `--copy` copies files instead of symlinking.

**Upload-only surfaces** (e.g. Claude Web / Cowork) — package the skill
locally first, then guide the user to upload:

```bash
npx skillship package <local-dir>   # -> dist/<name>.skill
```

- Claude Web: Settings → Capabilities → Upload skill → enable toggle.
- Claude Cowork: Customize → Skills → Upload (desktop app only).
