# {{name}}

An [Agent Skill](https://agentskills.io/specification) packaged for Cursor,
Claude Code, Claude Web, and Claude Cowork.

## Install

### Install into Cursor or Claude Code (recommended)

Install directly from this repo into your local agents:

```bash
npx skillship@latest install <owner>/<repo> -a cursor -a claude-code
# or, equivalently, via the underlying multi-agent installer:
npx skills add <owner>/<repo>
```

### Install into Claude Web or Cowork (upload a `.skill` file)

1. Download `{{dir}}.skill` from this repo's
   [Releases](https://github.com/<owner>/<repo>/releases/latest), or build it
   yourself with `npx skillship@latest package {{dir}}`.
2. Upload the `.skill` file:
   - Claude Web: Settings -> Capabilities -> Upload skill -> enable toggle.
   - Claude Cowork: Customize -> Skills -> Upload (desktop app only).

## Contributing

### Develop

- Validate: `npx skillship@latest validate {{dir}} --profile all`
- Package: `npx skillship@latest package {{dir}}` (produces
  `dist/{{dir}}.skill`)
- Install locally: `npx skillship@latest install {{dir}} -a cursor -a
  claude-code`

### Releasing

This repo auto-releases with
[release-please](https://github.com/googleapis/release-please-action) using
[Conventional Commits](https://www.conventionalcommits.org/). Merging the
generated release PR publishes `{{dir}}.skill` to a GitHub Release.

> Enable **Settings -> Actions -> Workflow permissions**: "Read and write" and
> "Allow GitHub Actions to create and approve pull requests".
