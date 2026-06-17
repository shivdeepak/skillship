# skillship

Make any [Agent Skill](https://agentskills.io/specification) (a `SKILL.md`
directory) portable across **Cursor**, **Claude Code**, **Claude Web**, and
**Claude Cowork**.

`skillship` is a thin orchestration layer. It does **not** reimplement the
multi-agent install matrix (that's [`npx skills`](https://skills.sh)) or host a
registry. It adds the three things the ecosystem is missing:

1. Strict, per-surface **validation profiles** (notably Claude's 200-char upload
   cap, which the official validator doesn't enforce).
2. **`.skill` packaging** for Claude Web / Cowork uploads.
3. **`init` scaffolding** with reusable release-please CI and commit
   conventions.
4. **Cursor rules and hooks install** — `install -a cursor` also copies
   `cursor/rules/*.mdc` and merges `cursor/hooks.json` entries alongside the
   `SKILL.md`.

## Install / usage

Both commands below use `npx`, which ships with [Node.js](https://nodejs.org)
(>= 18). If `npx` is not found, install Node.js first — e.g. download the LTS
installer from [nodejs.org](https://nodejs.org), or use a version manager
(`brew install node`, `nvm install --lts`, `winget install OpenJS.NodeJS.LTS`).
Verify with `node -v` and `npx -v`.

**Recommended:** install the bundled `/skillship` Agent Skill straight from
GitHub. It drives the CLI for you — invoke `/skillship` (or ask to publish a
skill) and the agent locates/scaffolds a `SKILL.md`, validates it, fixes issues,
and installs or packages it for the chosen surface:

```bash
npx skills add shivdeepak/skillship
```

Add `-a <agent>` (e.g. `-a cursor`, repeatable) to target specific agents, or
`-g` to install globally.

Or run the CLI directly with `npx` (requires Node.js >= 18):

```bash
npx skillship@latest <command>
```

## Commands

```
skillship validate <dir>    [--profile <p>] [--json]
skillship package  <dir>    [--out <dir>]
skillship install  [source] [-a <a,b>] [--global] [--copy]
skillship init     [name]   [--ci] [--snippets] [--new-dir]
skillship doctor
```

`<source>` for `install` is a local path (default `.`) **or** any remote ref
supported by `npx skills add`: `owner/repo`, `owner/repo@skill-name`, a full
GitHub/GitLab URL, or an SSH git URL. `validate` and `package` both default to
`.`: `validate` checks every skill found under it (or its `skills/`) and
`package` bundles them. A bare skill name resolves to
`skills/<name>/` by convention, so `validate my-skill` finds
`skills/my-skill/SKILL.md`. Sub-skills are flat sibling skills sharing a name
prefix; a `:`-namespaced name maps to a hyphenated sibling folder (e.g.
`validate skillship:author` resolves `skills/skillship-author/`). A repo can
hold many sibling skills under `skills/`, and discovery finds them all. All
commands exit non-zero on failure.

### validate

```bash
skillship validate                    # validate every skill under ./skills/
skillship validate skillship:author   # validate just one (bare-name convention)
skillship validate ./skills/my-skill  # validate an explicit skill dir
```

Discovers skills the same way `package` does (a lone `SKILL.md`, a bare name
under `skills/`, else every skill under `skills/`), validating each and exiting
non-zero if any fails. For each skill it parses the `SKILL.md` YAML frontmatter
(`name`, `description`, optional `license`, `metadata`, `allowed-tools`) and
body, then applies checks per profile:

| Check | spec | cursor | claude-web | claude-cowork |
| --- | --- | --- | --- | --- |
| `name` present, lowercase/numbers/hyphens, optional `:`-namespacing | yes | yes | yes | yes |
| `name` matches parent folder | yes | yes | yes | yes |
| `description` non-empty, no `<`/`>` | yes | yes | yes | yes |
| `description` length | <= 1024 | <= 1024 | **<= 200** | **<= 200** |
| Body recommended <= 500 lines | warn | warn | warn | warn |

`--profile` is one of `spec | cursor | claude-web | claude-cowork | all`
(default `all`, the strictest combination — description must be <= 200 chars).
`--json` emits machine-readable output for CI.

The frontmatter parser handles YAML block scalars (`>`, `>-`, `>+`, `|`, `|-`,
`|+`) and nested maps (e.g. `metadata:` with indented children) without
mis-joining keys. If `agentskills` (the Python spec validator) is on `PATH`, its
findings are merged in; it is never a hard dependency.

### package

```bash
skillship package            # bundle every skill under ./skills/ -> dist/<name>.skill
skillship package --out out  # -> out/<name>.skill
skillship package ./skills/my-skill   # bundle just one skill -> dist/my-skill.skill
```

Discovers every skill under `<dir>` (a lone `SKILL.md`, else each skill under
`skills/`), runs `validate --profile all` on each (aborts if any fails), then
bundles them all into a **single** `<name>.skill` zip. Each skill lives under
its own flat `<skill-name>/` folder, with `:` mapped to `-` so sibling skills
sit side by side (e.g. `skillship:author` → `skillship-author/`). Claude rejects
archives with files at the zip root. Excludes `__pycache__/`, `.DS_Store`,
`node_modules/`, `dist/`, `.git/`.

The bundle `<name>` is the single skill's name, or for multiple skills their
common prefix (e.g. `skillship`, `skillship-author`, `skillship-install` →
`skillship`), falling back to the project folder name. Because `:` and `/` are
not portable in filenames, they are rewritten to `-` in the output filename
(so a lone `skillship:author` packages to `skillship-author.skill`).

### install

```bash
# Local directory — installs every skill discovered under it (all siblings)
skillship install ./my-skill -a cursor -a claude-code

# GitHub shorthand — clones and installs in one step
npx skillship@latest install shivdeepak/knowledge-base-builder -a cursor -a claude-code

# Bare owner/repo installs ALL skills under the repo's skills/ directory
npx skillship@latest install shivdeepak/skillship

# GitHub shorthand with skill-name filter (install just one from a multi-skill repo)
npx skillship@latest install vercel-labs/agent-skills@frontend-design

# Subpath inside a repo
npx skillship@latest install org/monorepo/packages/my-skill

# Full GitHub or GitLab URL (with optional branch/path)
npx skillship@latest install https://github.com/org/repo/tree/main/skills/my-skill
npx skillship@latest install https://gitlab.com/org/repo/-/tree/main/skills/my-skill

# Any git URL (SSH, self-hosted, etc.)
npx skillship@latest install git@github.com:org/repo.git
npx skillship@latest install git@git.company.com:team/skills.git
```

For remote sources, skillship runs `git clone --depth 1` into a temp directory,
locates the `SKILL.md`, installs from there, then cleans up. `git` must be
available on `PATH` — run `skillship doctor` to check.

For filesystem agents, shells out to `npx skills add <dir> [--global] [--copy]
-y -a <agent> [-a <agent>]`. Default agents are `cursor` and `claude-code`.
`-y` is always passed so `npx skills` does not re-prompt — skillship gathers the
answers itself. For upload-only surfaces (`claude-web`, `claude-cowork`) it
prints upload instructions instead.

When run in an interactive terminal, `install` prompts before acting:

- If more than one skill will be installed, it lists them and asks for
  confirmation (e.g. `owner/repo` resolving to several sibling skills).
- If `-g`/`--global` was not passed, it asks whether to install globally (all
  projects) or in the current project.
- If `-c`/`--copy` was not passed, it asks whether to copy the files or symlink
  them.

Pass `-y`/`--yes` to skip every prompt and use the provided flags plus defaults
(project scope, symlink). In a non-interactive shell (CI, pipes) prompts are
skipped automatically. Explicit `--global`/`--copy` flags always suppress their
respective prompt.

When installing for **Cursor**, two additional steps run automatically if the
corresponding files exist inside the skill directory:

- `cursor/rules/*.mdc` → copied to `~/.cursor/rules/` (global) or
  `.cursor/rules/` (project)
- `cursor/hooks.json` → entries merged by event key and `command` into
  `~/.cursor/hooks.json` or
  `.cursor/hooks.json`

This means `skillship install` is a one-step command: it installs the skill,
its trigger rule, and any hooks without requiring manual file copying.

### init

```bash
skillship init demo --ci --snippets
```

Scaffolds a skill repo (see layout below) that auto-releases via
[release-please](https://github.com/googleapis/release-please-action) +
[Conventional Commits](https://www.conventionalcommits.org/). `--ci` adds the
GitHub Actions workflows; `--snippets` adds a Cursor rule and hooks file that
`skillship install` will automatically deploy.

By default `init` scaffolds **into the current directory** (the skill body goes
in `skills/<name>/SKILL.md`, repo files at the root). Pass `--new-dir` to create
a new `<name>/` project directory instead. The layout below is relative to that
root.

Re-running `init` on an existing skill is safe: it writes only missing files and
leaves existing ones (including your authored `SKILL.md`) untouched, so you can
backfill `--ci` or `--snippets` scaffolding later.

Scaffolded layout:

```
my-skill/
  skills/my-skill/SKILL.md
  cursor/                   # if --snippets
    rules/
      my-skill.mdc          # Cursor trigger rule (auto-installed)
    hooks.json              # Cursor hooks to merge (auto-installed)
  release-please-config.json
  .release-please-manifest.json
  version.txt
  .github/workflows/{validate,release}.yml
  .gitignore                # ignores dist/, node_modules/, .DS_Store
  AGENTS.md
  README.md
```

> After pushing the scaffolded repo, enable **Settings -> Actions -> Workflow
> permissions**: "Read and write" and "Allow GitHub Actions to create and
> approve pull requests" so release-please can open release PRs and upload the
> `.skill` asset.

The `SKILL.md` version line uses an inline marker so release-please updates it
in
place and the validator ignores it:

```yaml
metadata:
  version: "1.0.0" # x-release-please-version
```

### doctor

Checks the local environment: Node >= 18 and `npx` (required), plus `gh` and
`agentskills` (optional).

## Development

```bash
npm install
npm run build   # tsup -> dist/cli.js
npm run lint    # tsc --noEmit
npm test        # vitest
```

Project layout:

```
src/
  cli.ts                  # arg parsing, command dispatch (commander)
  commands/{validate,package,install,init,doctor}.ts
  lib/frontmatter.ts      # YAML frontmatter parser (block scalars + maps)
  lib/profiles.ts         # profile definitions and checks
  lib/zip.ts              # .skill packaging (archiver)
  lib/exec.ts             # spawn wrappers for npx skills / gh / agentskills
  lib/load.ts             # SKILL.md loader
  lib/remote.ts           # remote ref detection, URL parsing, git clone + skill dir resolution
templates/                # CI + snippet + AGENTS/README/SKILL templates for init
skills/skillship/         # bundled Agent Skill (the /skillship skill)
test/                     # vitest specs + fixtures
```

## Releases

Releases are automated via
[release-please](https://github.com/googleapis/release-please-action) +
[Conventional Commits](https://www.conventionalcommits.org/). On every push to
`main`, release-please opens/updates a release PR that bumps the version in
`package.json` and the `CHANGELOG.md` based on the commits since the last
release (`feat:` -> minor, `fix:`/`perf:` -> patch, `feat!:`/`BREAKING CHANGE`
-> major). Merging that PR tags the release and triggers `npm publish` from
`.github/workflows/release.yml`. `chore:`/`ci:` commits do not trigger a
release.

Publishing uses **npm trusted publishing (OIDC)** — no `NPM_TOKEN` secret. The
workflow requests a short-lived OIDC token (`id-token: write`) that npm verifies
against the trusted-publisher config; provenance attestations are generated
automatically.

`.github/workflows/ci.yml` runs lint + test + build on every push and PR.

One-time setup:

1. Enable **Settings -> Actions -> General -> Workflow permissions**: "Read and
   write" and "Allow GitHub Actions to create and approve pull requests" so
   release-please can open release PRs.
2. Publish `1.0.0` once manually (`npm publish --access public`) — trusted
   publishing can only be configured for a package that already exists.
3. On npmjs.com, open the package's **Access** page and add a **Trusted
   Publisher** for GitHub Actions, matching repo `shivdeepak/skillship` and
   workflow file `release.yml` exactly. After that, every release publishes
   tokenlessly. Optionally set the package to "require 2FA and disallow tokens"
   so only the workflow can publish.

## License

MIT
