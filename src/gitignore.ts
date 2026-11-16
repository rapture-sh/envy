import { readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

type Rule = {
  /** Compiled from the pattern, matched against a path relative to the ignore file. */
  test: RegExp;
  /** A `!` pattern, which takes a path back out of the ignore list. */
  negated: boolean;
  /** A pattern ending in `/`, which only ever matches a directory. */
  directoryOnly: boolean;
};

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/**
 * Turn one gitignore pattern into a regular expression.
 *
 * `*` stops at a slash, `**` does not, `?` is one character that is not a slash, and a
 * pattern with a slash anywhere but the end is anchored to the directory the ignore file
 * is in. A pattern without one matches at any depth, which is why `config.yml` on its own
 * covers the file wherever it sits.
 */
export function compilePattern(pattern: string): Rule | undefined {
  let body = pattern;
  let negated = false;

  if (body.startsWith("!")) {
    negated = true;
    body = body.slice(1);
  }

  if (body.startsWith("\\#") || body.startsWith("\\!")) body = body.slice(1);

  const directoryOnly = body.endsWith("/");

  if (directoryOnly) body = body.slice(0, -1);

  const anchored = body.includes("/");

  if (body.startsWith("/")) body = body.slice(1);
  if (body === "") return undefined;

  let source = "";

  for (let at = 0; at < body.length; at += 1) {
    const character = body[at];

    if (character === "*") {
      if (body[at + 1] === "*") {
        // `**/` swallows the slash as well, so `**/x` matches `x` at the top too.
        source += body[at + 2] === "/" ? "(?:.*/)?" : ".*";
        at += body[at + 2] === "/" ? 2 : 1;
      } else {
        source += "[^/]*";
      }

      continue;
    }

    if (character === "?") {
      source += "[^/]";

      continue;
    }

    source += (character ?? "").replace(/[.+^${}()|[\]\\]/gu, "\\$&");
  }

  return {
    test: new RegExp(anchored ? `^${source}$` : `^(?:.*/)?${source}$`, "u"),
    negated,
    directoryOnly,
  };
}

export function parseGitignore(text: string): Rule[] {
  return text
    .split(/\r?\n/u)
    .map((raw) => raw.replace(/\s+$/u, ""))
    .filter((raw) => raw !== "" && !raw.startsWith("#"))
    .map(compilePattern)
    .filter((rule): rule is Rule => rule !== undefined);
}

/**
 * Whether these rules ignore a path, which is the last rule that matches rather than the
 * first: a later `!config.yml` genuinely does take the file back out.
 *
 * Every parent directory is tested too, because a directory being ignored ignores
 * everything under it and nothing would say so from the file's own name.
 */
export function ignoredBy(rules: Rule[], relativePath: string): boolean {
  const parts = relativePath.split("/");
  const candidates = parts.map((_, at) => ({
    path: parts.slice(0, at + 1).join("/"),
    isDirectory: at < parts.length - 1,
  }));

  let ignored = false;

  for (const rule of rules) {
    for (const candidate of candidates) {
      if (rule.directoryOnly && !candidate.isDirectory) continue;
      if (!rule.test.test(candidate.path)) continue;

      ignored = !rule.negated;
    }
  }

  return ignored;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);

    return true;
  } catch {
    return false;
  }
}

async function readRules(path: string): Promise<Rule[]> {
  try {
    return parseGitignore(await readFile(path, "utf8"));
  } catch {
    return [];
  }
}

/** The directory holding `.git`, walking up from `from`. */
export async function findRepositoryRoot(from: string): Promise<string | undefined> {
  let directory = resolve(from);

  for (;;) {
    if (await exists(resolve(directory, ".git"))) return directory;

    const parent = dirname(directory);

    if (parent === directory) return undefined;

    directory = parent;
  }
}

export type IgnoredResult = {
  /** `false` when the file would be committed, which is what the warning is about. */
  ignored: boolean;
  /** Where the repository starts, or nothing when this is not a repository at all. */
  root: string | undefined;
};

/**
 * Whether git would ignore this file.
 *
 * Every `.gitignore` from the file's own directory up to the repository root is read, in
 * git's order: the closest file wins, so it is applied last.
 *
 * Outside a repository there is nothing to commit the file to, so there is nothing to warn
 * about either. Anywhere this cannot work out an answer it says "not ignored", because
 * warning about a file that was already safe costs a line of yellow and staying quiet
 * about one that is not costs a published credential.
 */
export async function isIgnored(filePath: string): Promise<IgnoredResult> {
  const absolute = isAbsolute(filePath) ? filePath : resolve(filePath);
  const root = await findRepositoryRoot(dirname(absolute));

  if (root === undefined) return { ignored: false, root: undefined };

  const directories: string[] = [];

  for (let directory = dirname(absolute); ; directory = dirname(directory)) {
    directories.unshift(directory);

    if (directory === root || dirname(directory) === directory) break;
  }

  const rules: Array<{ rule: Rule; from: string }> = [];

  for (const directory of [root, ...directories.filter((one) => one !== root)]) {
    for (const rule of await readRules(resolve(directory, ".gitignore"))) {
      rules.push({ rule, from: directory });
    }
  }

  for (const rule of await readRules(resolve(root, ".git", "info", "exclude"))) {
    rules.unshift({ rule, from: root });
  }

  let ignored = false;

  for (const { rule, from } of rules) {
    const relativePath = toPosix(relative(from, absolute));

    if (relativePath.startsWith("..")) continue;

    if (ignoredBy([rule], relativePath)) {
      ignored = true;
    } else if (rule.negated && rule.test.test(relativePath)) {
      ignored = false;
    }
  }

  return { ignored, root };
}
