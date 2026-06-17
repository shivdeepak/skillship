import { Command } from "commander";
import { createRequire } from "node:module";
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };
import { validateCommand } from "./commands/validate.js";
import { packageCommand } from "./commands/package.js";
import { installCommand } from "./commands/install.js";
import { initCommand } from "./commands/init.js";
import { doctorCommand } from "./commands/doctor.js";

const program = new Command();

program
  .name("skillship")
  .description(
    "Make any Agent Skill (SKILL.md) portable across Cursor, Claude Code, Claude Web, and Claude Cowork.",
  )
  .version(version);

program
  .command("validate")
  .description("Validate SKILL.md(s) against per-surface profiles (all skills under <dir> by default)")
  .argument("[dir]", "project or skill directory", ".")
  .option("--profile <p>", "spec | cursor | claude-web | claude-cowork | all", "all")
  .option("--json", "machine-readable output")
  .action(async (dir, opts) => {
    process.exit(await validateCommand(dir, opts));
  });

program
  .command("package")
  .description("Validate then bundle all skills under <dir> into one .skill zip for Claude upload")
  .argument("[dir]", "project or skill directory", ".")
  .option("--out <dir>", "output directory", "dist")
  .action(async (dir, opts) => {
    process.exit(await packageCommand(dir, opts));
  });

program
  .command("install")
  .description("Install a skill via `npx skills`, or print upload instructions")
  .argument("[source]", "local skill directory or remote ref (owner/repo, URL, git@...)", ".")
  .option("-a, --agent <agent>", "target agent (repeatable: -a cursor -a claude-code)", (val: string, prev: string[]) => [...prev, val], [] as string[])
  .option("--global", "install globally")
  .option("--copy", "copy instead of symlink")
  .action(async (dir, opts) => {
    process.exit(await installCommand(dir, opts));
  });

program
  .command("init")
  .description("Scaffold a skill into the current directory (or a new subdirectory with --new-dir)")
  .argument("[name]", "skill name")
  .option("--ci", "include GitHub Actions workflows")
  .option("--snippets", "include cursor/rules/<name>.mdc and cursor/hooks.json (auto-installed by `skillship install`)")
  .option("--new-dir", "create a new <name>/ project directory instead of using CWD")
  .action(async (name, opts) => {
    process.exit(await initCommand(name, opts));
  });

program
  .command("doctor")
  .description("Check the local environment for required/optional tools")
  .action(async () => {
    process.exit(await doctorCommand());
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
