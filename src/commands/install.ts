import { loadSkill } from "../lib/load.js";
import { buildSkillsAddArgv, isAvailable, run } from "../lib/exec.js";

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
  return code;
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
