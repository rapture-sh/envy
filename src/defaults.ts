export type Defaults = {
  /**
   * Milliseconds before anything that waits gives up, when the call does not say.
   *
   * There is deliberately no built-in default. envy cannot know whether `pnpm install` on
   * this machine takes four seconds or four minutes, and a ceiling that is wrong kills a
   * working setup halfway through. This is how a repository opts into one.
   */
  timeout?: number;

  /** `false` silences every warning for the process. */
  warn?: boolean;
};

let settings: Defaults = {};

/**
 * Set a timeout or a warning setting for the whole script. Any call overrides it.
 *
 * Read at call time rather than captured at import time, so calling this after the
 * imports still applies to everything that runs afterwards.
 */
export function defaults(next: Defaults): void {
  settings = { ...settings, ...next };
}

export function currentDefaults(): Defaults {
  return settings;
}

/** Only for tests. A script has no reason to put the settings back. */
export function resetDefaults(): void {
  settings = {};
}

/**
 * The timeout a call should use: its own, else the process-wide one, else none.
 */
export function resolveTimeout(given: number | undefined): number | undefined {
  return given ?? settings.timeout;
}
