import { join } from "node:path";
import { loadSkill } from "../lib/load.js";
import { validateProfile } from "../lib/profiles.js";
import { packSkill } from "../lib/zip.js";

export interface PackageOptions {
  out?: string;
}

export async function packageCommand(
  dir: string,
  options: PackageOptions,
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

  const result = validateProfile(loaded.parsed, loaded.dir, "all");
  if (!result.ok) {
    process.stderr.write("Cannot package: validation failed (--profile all).\n");
    for (const f of result.findings.filter((x) => x.severity === "error")) {
      process.stderr.write(`  ✗ ${f.check}: ${f.message}\n`);
    }
    process.stderr.write("\nRun `skillship validate` for details.\n");
    return 1;
  }

  const name = String(loaded.parsed.frontmatter.name);
  const outDir = options.out ?? join(process.cwd(), "dist");
  const outPath = await packSkill({ skillDir: loaded.dir, name, outDir });
  process.stdout.write(`Packaged ${name} -> ${outPath}\n`);
  return 0;
}
