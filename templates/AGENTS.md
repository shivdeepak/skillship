# Repository guide for agents

This repo packages the `{{name}}` Agent Skill for distribution across Cursor,
Claude Code, Claude Web, and Claude Cowork.

## Layout

- `skills/{{dir}}/SKILL.md` — the skill itself (source of truth).
- `cursor/rules/{{file}}.mdc` — Cursor rule; auto-installed by `skillship
  install -a cursor`.
- `cursor/hooks.json` — Cursor hook entries; merged into `~/.cursor/hooks.json`
  on install.
- `release-please-config.json`, `.release-please-manifest.json`, `version.txt` —
  release automation via release-please + Conventional Commits.
- `.github/workflows/validate.yml` — validates the skill on PRs/pushes.
- `.github/workflows/release.yml` — cuts releases and uploads `{{file}}.skill`.

## Conventions

- Use Conventional Commits (`feat:`, `fix:`, `docs:`, ...). `feat`/`fix` bump
  the
  version; merging the release PR publishes `{{file}}.skill` to a GitHub
  Release.
- Keep the `description` in `skills/{{dir}}/SKILL.md` <= 200 chars so it
  uploads to
  Claude Web/Cowork.
- The version line in `SKILL.md` carries `# x-release-please-version` so
  release-please updates it in place.

## Commands

- `npx skillship@latest validate --profile all`
- `npx skillship@latest package`
- `npx skillship@latest install {{dir}} -a cursor -a claude-code`
