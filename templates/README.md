# {{name}}

An [Agent Skill](https://agentskills.io/specification) packaged for Cursor,
Claude Code, Claude Web, and Claude Cowork.

## Develop

- Validate: `npx skillship@latest validate {{dir}} --profile all`
- Package: `npx skillship@latest package {{dir}}` (produces
  `dist/{{dir}}.skill`)
- Install locally: `npx skillship@latest install {{dir}} -a cursor -a
  claude-code`

## Upload to Claude

1. `npx skillship@latest package {{dir}}`
2. Upload `dist/{{dir}}.skill`:
   - Claude Web: Settings -> Capabilities -> Upload skill -> enable toggle.
   - Claude Cowork: Customize -> Skills -> Upload (desktop app only).

## Releasing

This repo auto-releases with
[release-please](https://github.com/googleapis/release-please-action) using
[Conventional Commits](https://www.conventionalcommits.org/). Merging the
generated release PR publishes `{{dir}}.skill` to a GitHub Release.

> Enable **Settings -> Actions -> Workflow permissions**: "Read and write" and
> "Allow GitHub Actions to create and approve pull requests".
