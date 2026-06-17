import { basename } from "node:path";
import { loadSkill } from "../lib/load.js";
import { discoverSkillDirs } from "../lib/discover.js";
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

interface SkillReport {
  name: string;
  dir: string;
  ok: boolean;
  results: ValidationResult[];
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

  const skillDirs = discoverSkillDirs(dir);
  if (skillDirs.length === 0) {
    const msg = `No SKILL.md found in ${dir} or under ${dir}/skills/.`;
    if (options.json) {
      process.stdout.write(
        JSON.stringify({ ok: false, error: msg }, null, 2) + "\n",
      );
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return 1;
  }

  const reports: SkillReport[] = [];
  for (const skillDir of skillDirs) {
    let loaded;
    try {
      loaded = await loadSkill(skillDir);
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

    const results = profilesToRun(profileArg).map((p) =>
      validateProfile(loaded.parsed, loaded.dir, p),
    );
    mergeAgentskills(loaded.dir, results);

    const name =
      typeof loaded.parsed.frontmatter.name === "string"
        ? loaded.parsed.frontmatter.name
        : basename(loaded.dir);
    reports.push({
      name,
      dir: loaded.dir,
      ok: results.every((r) => r.ok),
      results,
    });
  }

  const ok = reports.every((r) => r.ok);

  if (options.json) {
    process.stdout.write(JSON.stringify({ ok, skills: reports }, null, 2) + "\n");
  } else {
    printHuman(reports, ok);
  }

  return ok ? 0 : 1;
}

function printHuman(reports: SkillReport[], ok: boolean): void {
  const multiple = reports.length > 1;
  for (const report of reports) {
    if (multiple) {
      const status = report.ok ? "PASS" : "FAIL";
      process.stdout.write(`\n=== ${report.name} [${status}] ===\n`);
    }
    for (const result of report.results) {
      const errors = result.findings.filter((f) => f.severity === "error");
      const warnings = result.findings.filter((f) => f.severity === "warning");
      const status = result.ok ? "PASS" : "FAIL";
      process.stdout.write(`[${status}] profile: ${result.profile}\n`);
      for (const f of [...errors, ...warnings]) printFinding(f);
    }
  }
  process.stdout.write(ok ? "\nAll checks passed.\n" : "\nValidation failed.\n");
}

function printFinding(f: Finding): void {
  const tag = f.severity === "error" ? "  ✗" : "  ⚠";
  process.stdout.write(`${tag} ${f.check}: ${f.message}\n`);
}
