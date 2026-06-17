---
name: skillship:author
description: Author and publish an Agent Skill with the skillship CLI. Use when creating a new SKILL.md from scratch, converting an existing skill to portable, or publishing with CI.
---

# skillship:author

Drive the `skillship` CLI to author and publish a portable Agent Skill. Run the
CLI for the user; do not ask them to run commands manually.

## Workflow

Copy this checklist and track progress:

```
- [ ] 1. Locate or create the SKILL.md
- [ ] 2. Add missing scaffolding if needed (--ci, --snippets)
- [ ] 3. Validate (skillship validate)
- [ ] 4. Fix any reported issues, re-validate until clean
- [ ] 5. Confirm publish target with the user
- [ ] 6. Install (filesystem) or package (Claude upload)
```

### Step 1 — Locate or create the SKILL.md

A skill is a directory containing a `SKILL.md`. Find one in the project (search
for `SKILL.md`). Determine `<dir>` = the folder that directly contains it.

- **Already exists** → go to Step 2.
- **Does not exist** → scaffold a fresh skill. Always run `init` from the
  **project root** (it writes the skill body to `skills/<name>/SKILL.md` and
  repo files at the root):

```bash
npx skillship@latest init <name> --ci --snippets
```

Then author the `SKILL.md` body following the `create-skill` skill's rules
(third-person `description`, both WHAT and WHEN, under 500 lines). The skill
`name` must be lowercase letters/numbers/hyphens and match the parent folder.

The scaffolded `README.md` has `<owner>/<repo>` placeholders in its install
instructions. Replace them with the real GitHub owner/repo if you can determine
them (e.g. from `git remote get-url origin`); otherwise ask the user for the
values and fill them in.

### Step 2 — Add missing scaffolding to an existing skill

If the user already has a `SKILL.md` but is missing CI workflows, Cursor
snippets, or other boilerplate, re-run `init` **from the project root** with the
skill's `name`. It fills in only the missing files and leaves existing files
(including the authored `SKILL.md`) untouched:

```bash
npx skillship@latest init <name> --ci [--snippets]
```

- `--ci` adds `.github/workflows/validate.yml` and `release.yml` plus
  `release-please-config.json` for automated versioned releases.
- `--snippets` adds `cursor/rules/<name>.mdc` and `cursor/hooks.json` so
  `skillship install` auto-wires Cursor rules and hooks. Only include if the
  user wants Cursor-specific integration; omit for a surface-agnostic skill.
- Omit either flag if the user does not need that scaffolding.

### Step 3 — Validate

```bash
npx skillship@latest validate <dir> --profile all
```

`--profile all` is the strictest (Claude's 200-char description cap). Use
`--json` if you need to parse results programmatically.

### Step 4 — Fix and re-validate

Read each failure, edit the `SKILL.md`, and re-run validate until it exits 0.
Common failures: description over 200 chars, `name` not matching the folder,
`<`/`>` characters in the description, body over 500 lines (warning only).

### Step 5 — Confirm the publish target

Ask the user where to publish (use AskQuestion). Targets:

| Target | Mechanism |
| --- | --- |
| `cursor`, `claude-code` | Filesystem install |
| `claude-web`, `claude-cowork` | Upload-only `.skill` zip |

### Step 6 — Install or package

**Filesystem agents** (e.g. Cursor, Claude Code):

```bash
npx skillship@latest install <dir> -a cursor -a claude-code
```

Add `--global` to install for all projects, `--copy` to copy instead of
symlink.

**Upload-only surfaces** (e.g. Claude Web / Cowork):

```bash
npx skillship@latest package          # bundles every skill under skills/ -> dist/<name>.skill
```

`package` validates each skill, then bundles them all into one `.skill` zip.
`<name>` is the single skill's name or, for several skills, their common prefix
(`skillship-author` + `skillship-install` → `skillship`). Then tell the user to
upload `dist/<name>.skill`:
- Claude Web: Settings → Capabilities → Upload skill → enable toggle.
- Claude Cowork: Customize → Skills → Upload (desktop app only).

## Publishing via CI (optional)

If the skill was scaffolded with `init --ci`, it auto-releases via
release-please + Conventional Commits. After pushing, tell the user to enable
**Settings → Actions → Workflow permissions**: "Read and write" and "Allow
GitHub Actions to create and approve pull requests" so release-please can open
release PRs and attach the `.skill` asset.
