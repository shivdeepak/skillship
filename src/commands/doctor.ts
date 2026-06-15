import { isAvailable, runCapture } from "../lib/exec.js";

interface Check {
  name: string;
  required: boolean;
  ok: boolean;
  detail: string;
}

export async function doctorCommand(): Promise<number> {
  const checks: Check[] = [];

  const nodeOk = nodeVersionOk();
  checks.push({
    name: "node >= 18",
    required: true,
    ok: nodeOk,
    detail: process.version,
  });

  const npx = isAvailable("npx");
  checks.push({
    name: "npx (for `skills add`)",
    required: true,
    ok: npx,
    detail: npx ? "found" : "missing — install Node.js",
  });

  const gh = isAvailable("gh");
  checks.push({
    name: "gh (GitHub CLI, for releases)",
    required: false,
    ok: gh,
    detail: gh ? "found" : "optional — needed for release uploads",
  });

  const agentskills = isAvailable("agentskills");
  checks.push({
    name: "agentskills (optional spec validator)",
    required: false,
    ok: agentskills,
    detail: agentskills ? versionOf("agentskills") : "optional",
  });

  for (const c of checks) {
    const mark = c.ok ? "✓" : c.required ? "✗" : "–";
    process.stdout.write(`  ${mark} ${c.name}: ${c.detail}\n`);
  }

  const failedRequired = checks.some((c) => c.required && !c.ok);
  process.stdout.write(
    failedRequired
      ? "\nMissing required dependencies.\n"
      : "\nEnvironment looks good.\n",
  );
  return failedRequired ? 1 : 0;
}

function nodeVersionOk(): boolean {
  const major = Number(process.versions.node.split(".")[0]);
  return major >= 18;
}

function versionOf(cmd: string): string {
  const res = runCapture(cmd, ["--version"]);
  return (res.stdout || res.stderr).trim() || "found";
}
