# Repository guide for agents

This repo packages the `{{name}}` Agent Skill for distribution across Cursor,
Claude Code, Claude Web, and Claude Cowork.

## Layout

- `skills/{{name}}/SKILL.md` — the skill itself (source of truth).
- `cursor/rules/{{name}}.mdc` — Cursor rule; auto-installed by `skillship
  install -a cursor`.
- `cursor/hooks.json` — Cursor hook entries; merged into `~/.cursor/hooks.json`
  on install.
- `release-please-config.json`, `.release-please-manifest.json`, `version.txt` —
  release automation via release-please + Conventional Commits.
- `.github/workflows/validate.yml` — validates the skill on PRs/pushes.
- `.github/workflows/release.yml` — cuts releases and uploads `{{name}}.skill`.

## Conventions

- Use Conventional Commits (`feat:`, `fix:`, `docs:`, ...). `feat`/`fix` bump
  the
  version; merging the release PR publishes `{{name}}.skill` to a GitHub
  Release.
- Keep the `description` in `skills/{{name}}/SKILL.md` <= 200 chars so it
  uploads to
  Claude Web/Cowork.
- The version line in `SKILL.md` carries `# x-release-please-version` so
  release-please updates it in place.

## Commands

- `npx skillship validate {{name}} --profile all`
- `npx skillship package`
- `npx skillship install {{name}} -a cursor,claude-code`
