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
- [ ] 2. Confirm publish target AND whether to add Cursor snippets (ask the user)
- [ ] 3. Add missing scaffolding if needed (--ci, --snippets)
- [ ] 4. Validate (skillship validate)
- [ ] 5. Fix any reported issues, re-validate until clean
- [ ] 6. Install (filesystem) or package (Claude upload)
```

Ask the user the questions in Step 2 **before** running any `init`/`install`
command. Never silently pass `--snippets` or pick an install scope for them.

### Step 1 — Locate or create the SKILL.md

A skill is a directory containing a `SKILL.md`. Find one in the project (search
for `SKILL.md`). Determine `<dir>` = the folder that directly contains it.

- **Found at the project root** (a bare `./SKILL.md`, not already under
  `skills/<name>/`) → relocate it so it follows the standard layout:
  1. Read the `name` from the `SKILL.md` frontmatter. If absent, derive a
     candidate from the project folder name.
  2. Confirm the skill `name` with the user (use AskQuestion). It must be
     lowercase letters/numbers/hyphens (optionally `:`-namespaced).
  3. Move the file to `skills/<name>/SKILL.md` (`:` maps to `-` in the folder,
     e.g. `skillship:author` → `skills/skillship-author/`), then continue.
- **Already under `skills/<name>/`** → go to Step 2.
- **Does not exist** → scaffold a fresh skill. Always run `init` from the
  **project root** (it writes the skill body to `skills/<name>/SKILL.md` and
  repo files at the root). Do **not** pass `--snippets` yet — that is a separate
  decision made in Step 2:

```bash
npx skillship@latest init <name> --ci
```

Then author the `SKILL.md` body following the `create-skill` skill's rules
(third-person `description`, both WHAT and WHEN, under 500 lines). The skill
`name` must be lowercase letters/numbers/hyphens and match the parent folder.

The scaffolded `README.md` has `<owner>/<repo>` placeholders in its install
instructions. Replace them with the real GitHub owner/repo if you can determine
them (e.g. from `git remote get-url origin`); otherwise ask the user for the
values and fill them in.

### Step 2 — Confirm publish target and Cursor snippets

Ask the user two things (use AskQuestion) before scaffolding or installing:

1. **Publish target(s)** — where to publish. Targets:

| Target | Mechanism |
| --- | --- |
| `cursor`, `claude-code` | Filesystem install |
| `claude-web`, `claude-cowork` | Upload-only `.skill` zip |

2. **Cursor snippets** — only if `cursor` is a target. Snippets
   (`cursor/rules/<name>.mdc` + `cursor/hooks.json`) auto-wire a Cursor rule and
   hooks so the skill triggers automatically. This is **opt-in and separate**
   from installing into Cursor — never add it just because Cursor is a target.
   Ask "Add Cursor auto-trigger snippets (rules + hooks)?" and only pass
   `--snippets` if the user says yes.

### Step 3 — Add missing scaffolding

Re-run `init` **from the project root** with the skill's `name` to fill in any
missing CI workflows, snippets, or boilerplate. It writes only missing files and
leaves existing files (including the authored `SKILL.md`) untouched:

```bash
npx skillship@latest init <name> --ci [--snippets]
```

- `--ci` adds `.github/workflows/validate.yml` and `release.yml` plus
  `release-please-config.json` for automated versioned releases.
- `--snippets` adds `cursor/rules/<name>.mdc` and `cursor/hooks.json`. Include
  it
  **only if** the user opted in during Step 2.
- `init` also always writes a `.gitignore` (ignoring `dist/`, `node_modules/`,
  `.DS_Store`) so packaged artifacts and install output stay out of git.
- Omit either flag if the user does not need that scaffolding.

### Step 4 — Validate

```bash
npx skillship@latest validate <dir> --profile all
```

`--profile all` is the strictest (Claude's 200-char description cap). Use
`--json` if you need to parse results programmatically.

### Step 5 — Fix and re-validate

Read each failure, edit the `SKILL.md`, and re-run validate until it exits 0.
Common failures: description over 200 chars, `name` not matching the folder,
`<`/`>` characters in the description, body over 500 lines (warning only).

### Step 6 — Install or package

Use the targets confirmed in Step 2.

**Filesystem agents** (e.g. Cursor, Claude Code):

```bash
npx skillship@latest install <dir> --global -a cursor -a claude-code
```

Prefer `--global` when the skill lives in the project you are authoring it in:
the source already sits at `skills/<name>/`, so a project-scoped install would
copy/symlink it back into this same repo's `.cursor/` and `.claude/` (or
`.agents/`) dirs — needless duplication. `--global` installs once under
`~/.cursor` / `~/.claude` so the skill works everywhere, including here. Use a
project-scoped install (omit `--global`) only when installing into a *different*
consumer project. Add `--copy` to copy instead of symlink.

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
