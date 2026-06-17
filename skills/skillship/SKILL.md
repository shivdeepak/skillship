---
name: skillship
description: Turn a project into a publishable Agent Skill via the skillship CLI. Use to scaffold, validate, package, install, or publish a SKILL.md for Cursor, Claude Code, Claude Web, or Cowork, or on /skillship
---

# skillship

The `skillship` CLI makes Agent Skills portable across Cursor, Claude Code,
Claude Web, and Claude Cowork.

## Delegate to the right sub-skill

Based on user intent, read and follow the appropriate skill:

| User wants to… | Use skill |
| --- | --- |
| Create a new skill, convert an existing SKILL.md to portable, validate, or publish | `skillship-author` |
| Install a skill from a remote repo (GitHub, GitLab, SSH) | `skillship-install` |

## Invoking the CLI

Prefer `npx skillship@latest <command>`. If `npx skillship@latest` cannot
resolve the package
(not published / offline), run it from a local checkout instead:

```bash
npm run build            # in the skillship repo, produces dist/cli.js
node dist/cli.js <command>
```

Run `npx skillship@latest doctor` to verify the environment (Node >= 18, npx;
optional
`gh` and `agentskills`).
