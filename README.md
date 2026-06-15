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

## Install / usage

```bash
npx skillship <command>
```

Requires Node.js >= 18.

## Commands

```
skillship validate <dir> [--profile <p>] [--json]
skillship package  <dir> [--out <dir>]
skillship install  <dir> [--agent <a,b>] [--global] [--copy]
skillship init     [name] [--ci] [--snippets]
skillship doctor
```

`<dir>` defaults to `.` and must contain a `SKILL.md`. Validation exits non-zero
on failure.

### validate

Parses the `SKILL.md` YAML frontmatter (`name`, `description`, optional
`license`, `metadata`, `allowed-tools`) and body, then applies checks per
profile:

| Check | spec | cursor | claude-web | claude-cowork |
| --- | --- | --- | --- | --- |
| `name` present, lowercase/numbers/hyphens | yes | yes | yes | yes |
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
skillship package ./my-skill            # -> dist/my-skill.skill
skillship package ./my-skill --out out  # -> out/my-skill.skill
```

Runs `validate --profile all` first (aborts on failure), then produces a
`<name>.skill` zip whose **archive root is the skill folder** (entries are
`<name>/SKILL.md`, ...) — Claude rejects archives with files at the zip root.
Excludes `__pycache__/`, `.DS_Store`, `node_modules/`, `dist/`, `.git/`.

### install

```bash
skillship install ./my-skill -a cursor,claude-code
```

For filesystem agents, shells out to `npx skills add <dir> [--global] [--copy]
-a <agents>`. Default agents are `cursor,claude-code`. For upload-only surfaces
(`claude-web`, `claude-cowork`) it prints upload instructions instead.

### init

```bash
skillship init demo --ci --snippets
```

Scaffolds a skill repo (see layout below) that auto-releases via
[release-please](https://github.com/googleapis/release-please-action) +
[Conventional Commits](https://www.conventionalcommits.org/). `--ci` adds the
GitHub Actions workflows; `--snippets` adds `cursor-rule.mdc` and
`claude-md.md`.

Scaffolded layout:

```
my-skill/
  my-skill/SKILL.md
  snippets/                 # if --snippets
    cursor-rule.mdc
    claude-md.md
  release-please-config.json
  .release-please-manifest.json
  version.txt
  .github/workflows/{validate,release}.yml
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

## Bundled skill (`/skillship`)

skillship ships with its own Agent Skill at `skillship/SKILL.md`. Installed into
any agent, it drives the CLI for you: invoke `/skillship` (or ask to publish a
skill) and the agent locates/scaffolds the `SKILL.md`, validates it, fixes
issues, and installs or packages it for the chosen surface.

Install it like any other skill, into whichever agents you use:

```bash
npx skills add ./skillship -a cursor,claude-code [--global]
# or, dogfooding skillship itself:
npx skillship install ./skillship -a cursor,claude-code
```

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
templates/                # CI + snippet + AGENTS/README/SKILL templates for init
skillship/                # bundled Agent Skill (the /skillship skill)
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
