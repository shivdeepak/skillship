import { spawn, spawnSync } from "node:child_process";

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Build the argv (program + args) for installing via `npx skills`. */
export function buildSkillsAddArgv(opts: {
  dir: string;
  agents: string[];
  global?: boolean;
  copy?: boolean;
  /** Pass `-y` so `npx skills` does not re-prompt (skillship already asked). */
  yes?: boolean;
}): string[] {
  const argv = ["skills", "add", opts.dir];
  if (opts.global) argv.push("--global");
  if (opts.copy) argv.push("--copy");
  if (opts.yes) argv.push("-y");
  for (const agent of opts.agents) argv.push("-a", agent);
  return argv;
}

/** Run a command, inheriting stdio so the user sees live output. */
export function run(
  command: string,
  args: string[],
  opts: { cwd?: string } = {},
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      stdio: "inherit",
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/** Check whether an executable is available on PATH. */
export function isAvailable(command: string): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  const res = spawnSync(probe, [command], { stdio: "ignore" });
  return res.status === 0;
}

/** Run a command capturing output (used for optional agentskills merge). */
export function runCapture(
  command: string,
  args: string[],
  opts: { cwd?: string } = {},
): ExecResult {
  const res = spawnSync(command, args, {
    cwd: opts.cwd,
    encoding: "utf8",
  });
  return {
    code: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}
