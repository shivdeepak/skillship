import { loadSkill } from "../lib/load.js";
import {
  PROFILE_NAMES,
  validateProfile,
  type Finding,
  type ProfileName,
  type ValidationResult,
} from "../lib/profiles.js";
import { isAvailable, runCapture } from "../lib/exec.js";

export interface ValidateOptions {
  profile?: string;
  json?: boolean;
}

function profilesToRun(profile: ProfileName): ProfileName[] {
  if (profile === "all") return ["all"];
  return [profile];
}

function mergeAgentskills(dir: string, results: ValidationResult[]): void {
  if (!isAvailable("agentskills")) return;
  const res = runCapture("agentskills", ["validate", dir]);
  if (res.code !== 0) {
    const message =
      (res.stderr || res.stdout || "agentskills reported errors").trim();
    for (const r of results) {
      r.findings.push({
        severity: "error",
        check: "agentskills",
        message,
      });
      r.ok = false;
    }
  }
}

export async function validateCommand(
  dir: string,
  options: ValidateOptions,
): Promise<number> {
  const profileArg = (options.profile ?? "all") as ProfileName;
  if (!PROFILE_NAMES.includes(profileArg)) {
    process.stderr.write(
      `Unknown profile "${profileArg}". Valid: ${PROFILE_NAMES.join(", ")}\n`,
    );
    return 2;
  }

  let loaded;
  try {
    loaded = await loadSkill(dir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      process.stdout.write(
        JSON.stringify({ ok: false, error: msg }, null, 2) + "\n",
      );
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return 1;
  }

  const results: ValidationResult[] = profilesToRun(profileArg).map((p) =>
    validateProfile(loaded.parsed, loaded.dir, p),
  );

  mergeAgentskills(loaded.dir, results);

  const ok = results.every((r) => r.ok);

  if (options.json) {
    process.stdout.write(JSON.stringify({ ok, results }, null, 2) + "\n");
  } else {
    printHuman(results, ok);
  }

  return ok ? 0 : 1;
}

function printHuman(results: ValidationResult[], ok: boolean): void {
  for (const result of results) {
    const errors = result.findings.filter((f) => f.severity === "error");
    const warnings = result.findings.filter((f) => f.severity === "warning");
    const status = result.ok ? "PASS" : "FAIL";
    process.stdout.write(`[${status}] profile: ${result.profile}\n`);
    for (const f of [...errors, ...warnings]) printFinding(f);
  }
  process.stdout.write(ok ? "\nAll checks passed.\n" : "\nValidation failed.\n");
}

function printFinding(f: Finding): void {
  const tag = f.severity === "error" ? "  ✗" : "  ⚠";
  process.stdout.write(`${tag} ${f.check}: ${f.message}\n`);
}
