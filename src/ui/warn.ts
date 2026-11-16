import { currentDefaults } from "../defaults.js";
import { dim, yellow } from "./colour.js";
import { line } from "./out.js";

export type WarnOptions = {
  /** `false` silences this warning. */
  warn?: boolean;
};

export type Warning = {
  /** One line saying what is wrong. */
  title: string;
  /** What to do about it. Printed dim, under the title. */
  detail?: string[];
  /**
   * What makes this warning the same warning. The first one printed for a cause wins, so a
   * loop that hits the same problem ten times says it once.
   */
  key?: string;
};

let runWarn: boolean | undefined;
let seen = new Set<string>();

/** `ui.run` sets this for the duration of a run. */
export function setRunWarn(value: boolean | undefined): void {
  runWarn = value;
}

/** Only for tests, and for `ui.run` putting things back when it finishes. */
export function resetWarnings(): void {
  runWarn = undefined;
  seen = new Set();
}

/**
 * Whether a warning should be printed at all.
 *
 * Narrowest first: the call, then the run, then the process-wide setting, then the
 * environment. A warning is never fatal, so every one of these is a legitimate answer.
 */
export function warningsEnabled(options: WarnOptions = {}): boolean {
  if (options.warn !== undefined) return options.warn;
  if (runWarn !== undefined) return runWarn;

  const { warn } = currentDefaults();

  if (warn !== undefined) return warn;

  const silenced = process.env.ENVY_NO_WARN;

  return silenced === undefined || silenced === "";
}

/**
 * Print a warning block. Never throws, never exits, never prints a value: a caller passes
 * the name of a setting, not what is in it.
 */
export function warn(warning: Warning, options: WarnOptions = {}): void {
  if (!warningsEnabled(options)) return;

  if (warning.key !== undefined) {
    if (seen.has(warning.key)) return;

    seen.add(warning.key);
  }

  line();
  line(`${yellow("!")} ${warning.title}`);

  for (const detail of warning.detail ?? []) line(`  ${dim(detail)}`);
}
