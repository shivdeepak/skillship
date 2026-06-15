# {{name}}

An [Agent Skill](https://agentskills.io/specification) packaged for Cursor,
Claude Code, Claude Web, and Claude Cowork.

## Develop

- Validate: `npx skillship validate {{name}} --profile all`
- Package: `npx skillship package {{name}}` (produces `dist/{{name}}.skill`)
- Install locally: `npx skillship install {{name}} -a cursor,claude-code`

## Upload to Claude

1. `npx skillship package {{name}}`
2. Upload `dist/{{name}}.skill`:
   - Claude Web: Settings -> Capabilities -> Upload skill -> enable toggle.
   - Claude Cowork: Customize -> Skills -> Upload (desktop app only).

## Releasing

This repo auto-releases with
[release-please](https://github.com/googleapis/release-please-action) using
[Conventional Commits](https://www.conventionalcommits.org/). Merging the
generated release PR publishes `{{name}}.skill` to a GitHub Release.

> Enable **Settings -> Actions -> Workflow permissions**: "Read and write" and
> "Allow GitHub Actions to create and approve pull requests".
