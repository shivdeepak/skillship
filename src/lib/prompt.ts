import { createInterface } from "node:readline/promises";

/** True when both stdin and stdout are attached to a terminal (can prompt). */
export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Ask a yes/no question. Returns `defaultYes` on empty input. */
export async function confirm(
  question: string,
  defaultYes = true,
): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    const answer = (await rl.question(`${question} ${hint} `)).trim().toLowerCase();
    if (answer === "") return defaultYes;
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

export interface ChoiceOption<T> {
  /** Single-letter key the user types (e.g. "g"). */
  key: string;
  /** Long-form word also accepted (e.g. "global"). */
  label: string;
  value: T;
}

/**
 * Ask the user to pick one of several options by key or label. Returns the
 * default option's value on empty input, and re-prompts on invalid input.
 */
export async function choice<T>(
  question: string,
  options: ChoiceOption<T>[],
  defaultKey: string,
): Promise<T> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const hint = options
      .map((o) => (o.key === defaultKey ? o.key.toUpperCase() : o.key))
      .join("/");
    for (;;) {
      const raw = (await rl.question(`${question} [${hint}] `)).trim().toLowerCase();
      const key = raw === "" ? defaultKey : raw;
      const match = options.find(
        (o) => o.key === key || o.label.toLowerCase() === key,
      );
      if (match) return match.value;
      process.stdout.write(
        `Please enter one of: ${options.map((o) => `${o.key} (${o.label})`).join(", ")}\n`,
      );
    }
  } finally {
    rl.close();
  }
}
