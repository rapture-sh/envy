import { type CmdResult, cmd, parseCommand } from "./cmd.js";
import { Fail } from "./errors.js";
import { checkReport } from "./ui/checks.js";

export type Check = {
  /** What to call it in the report. */
  name: string;

  /**
   * The command that decides it, run through `cmd` and never through a shell. Exit zero
   * passes.
   */
  run: string | string[];

  /**
   * A version range the output has to satisfy, such as `">=22"` or `">=3.11 <4"`. Terms
   * are separated by spaces and all of them have to hold.
   */
  version?: string;

  /**
   * Where the version is in the output, when the first number in it is the wrong one. The
   * first capture group is read as the version.
   */
  match?: RegExp;

  /** A decision of your own, on top of the exit code. */
  ok?: (result: CmdResult) => boolean;

  /** What a human should do about a failure. Printed under the line that failed. */
  fix?: string;

  /** Milliseconds before giving up on this one. There is no default: see `defaults`. */
  timeout?: number;

  /** Reported when it fails, but never fails the run. */
  optional?: boolean;
};

export type CheckOutcome = {
  name: string;
  ok: boolean;
  optional: boolean;
  /** The version that was found, when the check looked for one. */
  found?: string;
  /** Why it failed, in the words the report prints. */
  reason?: string;
  fix?: string;
};

export type CheckOptions = {
  /** Return the outcomes for a failure instead of throwing. */
  allowFailure?: boolean;
};

/**
 * The first version-shaped thing in the output.
 *
 * Both streams are searched, because `java -version` and older `python --version` write to
 * stderr while most tools write to stdout, and a prerequisite check should not care which.
 */
const VERSION = /\bv?(\d+(?:\.\d+){0,2})\b/u;

const COMPARATOR = /^(>=|<=|>|<|=)?v?(\d+(?:\.\d+){0,2})$/u;

function parts(version: string): [number, number, number] {
  const [major, minor, patch] = version.split(".");

  return [Number(major ?? 0), Number(minor ?? 0), Number(patch ?? 0)];
}

/** Negative, zero or positive, the way a comparator is expected to answer. */
export function compareVersions(left: string, right: string): number {
  const a = parts(left);
  const b = parts(right);

  for (let at = 0; at < 3; at += 1) {
    const difference = (a[at] ?? 0) - (b[at] ?? 0);

    if (difference !== 0) return difference < 0 ? -1 : 1;
  }

  return 0;
}

/**
 * Whether a version satisfies a range.
 *
 * Deliberately not semver: there are no carets, tildes or prereleases, because a
 * prerequisite is "new enough to work" and anything cleverer would be a dependency or a
 * second implementation of one. A missing part is zero, so `3.11` is `3.11.0` and
 * `">=3.11"` passes for `3.11.5`.
 */
export function satisfies(version: string, range: string): boolean {
  const terms = range.trim().split(/\s+/u).filter(Boolean);

  if (terms.length === 0) throw new Fail(`"${range}" is not a version range.`);

  return terms.every((term) => {
    const found = COMPARATOR.exec(term);

    if (found === null) {
      throw new Fail(
        `"${term}" is not a version range envy understands. Write one of >=, >, <=, < or = in front of a version, as in ">=22".`,
      );
    }

    const [, operator = "=", wanted = "0"] = found;
    const order = compareVersions(version, wanted);

    if (operator === ">=") return order >= 0;
    if (operator === ">") return order > 0;
    if (operator === "<=") return order <= 0;
    if (operator === "<") return order < 0;

    return order === 0;
  });
}

function programOf(run: string | string[]): string {
  const parsed = typeof run === "string" ? parseCommand(run) : run;

  return parsed[0] ?? "the command";
}

async function runCheck(item: Check): Promise<CheckOutcome> {
  // `fix` is spread in only when it was given, because `exactOptionalPropertyTypes` makes
  // an absent property and one holding `undefined` two different things.
  const base = {
    name: item.name,
    optional: item.optional === true,
    ...(item.fix === undefined ? {} : { fix: item.fix }),
  };
  let result: CmdResult;

  try {
    // `allowFailure` because a non-zero exit is an answer here rather than an accident,
    // and the report wants to say which code it was.
    result = await cmd(item.run, {
      allowFailure: true,
      ...(item.timeout === undefined ? {} : { timeout: item.timeout }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : `${programOf(item.run)} would not run`;

    return { ...base, ok: false, reason };
  }

  if (result.code !== 0) {
    return { ...base, ok: false, reason: `${programOf(item.run)} exited ${result.code}` };
  }

  if (item.ok !== undefined && !item.ok(result)) {
    return { ...base, ok: false, reason: `${programOf(item.run)} ran, but the check refused it` };
  }

  if (item.version === undefined) return { ...base, ok: true };

  const found = (item.match ?? VERSION).exec(`${result.out}\n${result.err}`)?.[1];

  if (found === undefined) {
    return { ...base, ok: false, reason: `could not read a version out of ${programOf(item.run)}` };
  }

  if (!satisfies(found, item.version)) {
    return { ...base, ok: false, found, reason: `found ${found}, needs ${item.version}` };
  }

  return { ...base, ok: true, found };
}

/**
 * Run every prerequisite, then report all of them at once.
 *
 * All of them run, always, including the ones after the first failure. A setup that stops
 * at the first missing tool makes somebody install it, run again, and find out about the
 * next one, which is the slowest possible way to learn what a machine needs. One pass, one
 * list, one trip to go and fix things.
 *
 * Nothing here spawns: every check goes through `cmd`, so it inherits the timeout, the
 * Windows shim and the rule that nothing reaches a shell.
 */
export async function check(checks: Check[], options: CheckOptions = {}): Promise<CheckOutcome[]> {
  const outcomes = await Promise.all(checks.map(runCheck));

  checkReport(outcomes);

  const failed = outcomes.filter((outcome) => !outcome.ok && !outcome.optional);

  if (failed.length > 0 && options.allowFailure !== true) {
    const names = failed.map((outcome) => outcome.name).join(", ");

    throw new Fail(
      `${failed.length} prerequisite${failed.length === 1 ? " is" : "s are"} not met: ${names}.`,
    );
  }

  return outcomes;
}
