import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export interface InitOptions {
  ci?: boolean;
  snippets?: boolean;
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

async function renderTemplate(file: string, name: string): Promise<string> {
  const raw = await readFile(join(templatesDir(), file), "utf8");
  return raw.replaceAll("{{name}}", name);
}

async function emit(target: string, content: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

export async function initCommand(
  name: string | undefined,
  options: InitOptions,
): Promise<number> {
  const skillName = name ?? "my-skill";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(skillName)) {
    process.stderr.write(
      `Invalid skill name "${skillName}". Use lowercase letters, numbers, and single hyphens.\n`,
    );
    return 1;
  }

  const root = resolve(process.cwd(), skillName);
  if (existsSync(root)) {
    process.stderr.write(`Error: directory "${skillName}" already exists.\n`);
    return 1;
  }

  const writes: Array<[string, string]> = [];

  writes.push([
    join(root, skillName, "SKILL.md"),
    await renderTemplate("SKILL.md", skillName),
  ]);
  writes.push([join(root, "README.md"), await renderTemplate("README.md", skillName)]);
  writes.push([join(root, "AGENTS.md"), await renderTemplate("AGENTS.md", skillName)]);
  writes.push([
    join(root, "release-please-config.json"),
    await renderTemplate("release-please-config.json", skillName),
  ]);
  writes.push([
    join(root, ".release-please-manifest.json"),
    JSON.stringify({ ".": "1.0.0" }, null, 2) + "\n",
  ]);
  writes.push([join(root, "version.txt"), "1.0.0\n"]);

  if (options.ci) {
    writes.push([
      join(root, ".github", "workflows", "validate.yml"),
      await renderTemplate("validate.yml", skillName),
    ]);
    writes.push([
      join(root, ".github", "workflows", "release.yml"),
      await renderTemplate("release.yml", skillName),
    ]);
  }

  if (options.snippets) {
    writes.push([
      join(root, "cursor", "rules", `${skillName}.mdc`),
      await renderTemplate("cursor-rule.mdc", skillName),
    ]);
    writes.push([
      join(root, "cursor", "hooks.json"),
      await renderTemplate("cursor-hooks.json", skillName),
    ]);
  }

  for (const [target, content] of writes) {
    await emit(target, content);
  }

  process.stdout.write(`Scaffolded ${skillName}/ (${writes.length} files)\n`);
  process.stdout.write(`  cd ${skillName}\n`);
  process.stdout.write(`  npx skillship validate ${skillName} --profile all\n`);
  return 0;
}
