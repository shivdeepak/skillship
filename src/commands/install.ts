import { loadSkill } from "../lib/load.js";
import { buildSkillsAddArgv, isAvailable, run } from "../lib/exec.js";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface InstallOptions {
  agent?: string;
  global?: boolean;
  copy?: boolean;
}

const DEFAULT_AGENTS = ["cursor", "claude-code"];
const UPLOAD_ONLY = new Set(["claude-web", "claude-cowork"]);

export async function installCommand(
  dir: string,
  options: InstallOptions,
): Promise<number> {
  let loaded;
  try {
    loaded = await loadSkill(dir);
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }

  const requested = options.agent
    ? options.agent.split(",").map((a) => a.trim()).filter(Boolean)
    : DEFAULT_AGENTS;

  const uploadOnly = requested.filter((a) => UPLOAD_ONLY.has(a));
  const filesystem = requested.filter((a) => !UPLOAD_ONLY.has(a));

  if (uploadOnly.length > 0) {
    printUploadInstructions(uploadOnly, String(loaded.parsed.frontmatter.name));
  }

  if (filesystem.length === 0) return 0;

  if (!isAvailable("npx")) {
    process.stderr.write(
      "Error: `npx` not found. Install Node.js (>=18). Run `skillship doctor`.\n",
    );
    return 1;
  }

  const argv = buildSkillsAddArgv({
    dir: loaded.dir,
    agents: filesystem,
    global: options.global,
    copy: options.copy,
  });
  process.stdout.write(`Running: npx ${argv.join(" ")}\n`);
  const code = await run("npx", argv);

  if (code === 0 && filesystem.includes("cursor")) {
    installCursorExtras(loaded.dir, options.global ?? false);
  }

  return code;
}

/**
 * Install agent-specific extras from the skill's `cursor/` directory.
 *
 * - `cursor/rules/*.mdc`  → copied to `<base>/rules/`
 * - `cursor/hooks.json`   → entries merged (by name) into `<base>/hooks.json`
 *
 * `<base>` is `~/.cursor` for global installs, `.cursor` for project installs.
 */
function installCursorExtras(skillDir: string, global: boolean): void {
  const base = global
    ? join(homedir(), ".cursor")
    : join(process.cwd(), ".cursor");

  const rulesDir = join(skillDir, "cursor", "rules");
  if (existsSync(rulesDir)) {
    const destRules = join(base, "rules");
    mkdirSync(destRules, { recursive: true });
    for (const file of readdirSync(rulesDir)) {
      const src = join(rulesDir, file);
      const dest = join(destRules, file);
      copyFileSync(src, dest);
      process.stdout.write(`  Installed Cursor rule  → ${dest}\n`);
    }
  }

  const hooksSrc = join(skillDir, "cursor", "hooks.json");
  if (existsSync(hooksSrc)) {
    mergeHooks(hooksSrc, join(base, "hooks.json"));
  }
}

function mergeHooks(srcPath: string, destPath: string): void {
  type HookEntry = Record<string, unknown>;
  type HooksFile = { version?: number; hooks?: Record<string, HookEntry[]> };

  let incoming: HooksFile = {};
  try {
    incoming = JSON.parse(readFileSync(srcPath, "utf8")) as HooksFile;
  } catch {
    process.stderr.write(`  Warning: could not parse ${srcPath}, skipping hooks merge.\n`);
    return;
  }

  const incomingHooks = incoming.hooks ?? {};
  if (Object.keys(incomingHooks).length === 0) return;

  let existing: HooksFile = { version: 1, hooks: {} };
  if (existsSync(destPath)) {
    try {
      existing = JSON.parse(readFileSync(destPath, "utf8")) as HooksFile;
    } catch {
      existing = { version: 1, hooks: {} };
    }
  }

  const existingHooks: Record<string, HookEntry[]> = existing.hooks ?? {};
  let added = 0;

  for (const [event, entries] of Object.entries(incomingHooks)) {
    const current = existingHooks[event] ?? [];
    const existingCommands = new Set(current.map((h) => h.command));
    const toAdd = entries.filter((h) => !existingCommands.has(h.command));
    if (toAdd.length > 0) {
      existingHooks[event] = [...current, ...toAdd];
      added += toAdd.length;
    }
  }

  if (added === 0) return;

  mkdirSync(join(destPath, ".."), { recursive: true });
  writeFileSync(
    destPath,
    JSON.stringify({ ...existing, hooks: existingHooks }, null, 2) + "\n",
  );
  process.stdout.write(`  Merged ${added} Cursor hook(s)  → ${destPath}\n`);
}

function printUploadInstructions(agents: string[], name: string): void {
  process.stdout.write(
    `\nThe following surfaces are upload-only (no filesystem install): ${agents.join(", ")}\n`,
  );
  process.stdout.write(
    `Run \`skillship package .\` then upload \`dist/${name}.skill\`.\n`,
  );
  if (agents.includes("claude-web")) {
    process.stdout.write(
      "  Claude Web: Settings -> Capabilities -> Upload skill -> enable toggle.\n",
    );
  }
  if (agents.includes("claude-cowork")) {
    process.stdout.write(
      "  Claude Cowork: Customize -> Skills -> Upload (desktop app only).\n",
    );
  }
  process.stdout.write("\n");
}
