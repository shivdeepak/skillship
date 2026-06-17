import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { NAME_RE } from "../lib/profiles.js";

export interface InitOptions {
  ci?: boolean;
  snippets?: boolean;
  newDir?: boolean;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the templates directory. After bundling, cli.js lives in dist/ and
 * templates/ sits next to it at the package root.
 */
function templatesDir(): string {
  const candidates = [
    join(__dirname, "..", "templates"), // dist/cli.js -> repo/templates
    join(__dirname, "..", "..", "templates"), // src/commands -> repo/templates
    join(__dirname, "templates"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

async function renderTemplate(file: string, name: string, dir: string): Promise<string> {
  const raw = await readFile(join(templatesDir(), file), "utf8");
  return raw.replaceAll("{{name}}", name).replaceAll("{{dir}}", dir);
}

/** Write `content` to `target` only when it does not already exist. Returns
 * true if a file was written, false if an existing file was left untouched. */
async function emit(target: string, content: string): Promise<boolean> {
  if (existsSync(target)) return false;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
  return true;
}

export async function initCommand(
  name: string | undefined,
  options: InitOptions,
): Promise<number> {
  const skillName = name ?? "my-skill";
  if (!NAME_RE.test(skillName)) {
    process.stderr.write(
      `Invalid skill name "${skillName}". Use lowercase letters, numbers, and single hyphens, optionally namespaced with ':' (e.g. "skillship:author").\n`,
    );
    return 1;
  }

  // Filesystem-safe form of the name: a namespaced skill like "skillship:author"
  // keeps its colon in the SKILL.md `name`, but every directory, filename, and
  // release asset uses a hyphen ("skillship-author").
  const dirName = skillName.replaceAll(":", "-");

  // By default, scaffold into the current directory. With --new-dir, create
  // a new project subdirectory named after the skill (legacy behaviour).
  const root = options.newDir ? resolve(process.cwd(), dirName) : process.cwd();

  if (options.newDir && existsSync(root)) {
    process.stderr.write(`Error: directory "${dirName}" already exists.\n`);
    return 1;
  }

  // Always scaffold under skills/<dir>/. Re-running on an existing skill is
  // allowed: emit() skips files that already exist, so missing scaffolding
  // (CI, snippets, repo files) is filled in without touching the authored
  // SKILL.md.
  const skillDir = join(root, "skills", dirName);

  const render = (file: string) => renderTemplate(file, skillName, dirName);
  const writes: Array<[string, string]> = [];

  writes.push([join(skillDir, "SKILL.md"), await render("SKILL.md")]);
  writes.push([join(root, "README.md"), await render("README.md")]);
  writes.push([join(root, "AGENTS.md"), await render("AGENTS.md")]);
  writes.push([
    join(root, "release-please-config.json"),
    await render("release-please-config.json"),
  ]);
  writes.push([
    join(root, ".release-please-manifest.json"),
    JSON.stringify({ ".": "1.0.0" }, null, 2) + "\n",
  ]);
  writes.push([join(root, "version.txt"), "1.0.0\n"]);

  if (options.ci) {
    writes.push([
      join(root, ".github", "workflows", "validate.yml"),
      await render("validate.yml"),
    ]);
    writes.push([
      join(root, ".github", "workflows", "release.yml"),
      await render("release.yml"),
    ]);
  }

  if (options.snippets) {
    writes.push([
      join(root, "cursor", "rules", `${dirName}.mdc`),
      await render("cursor-rule.mdc"),
    ]);
    writes.push([
      join(root, "cursor", "hooks.json"),
      await render("cursor-hooks.json"),
    ]);
  }

  let created = 0;
  for (const [target, content] of writes) {
    if (await emit(target, content)) created += 1;
  }

  const skipped = writes.length - created;
  const suffix = skipped > 0 ? `, ${skipped} already present` : "";
  const hint = options.newDir ? `  cd ${dirName}\n` : "";
  process.stdout.write(`Scaffolded skills/${dirName}/ (${created} files written${suffix})\n`);
  process.stdout.write(hint);
  process.stdout.write(`  npx skillship@latest validate ${dirName} --profile all\n`);
  return 0;
}
