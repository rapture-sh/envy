/**
 * Every byte envy prints goes through here.
 *
 * `process.stdout.write` rather than `console`, so there is one seam a test can spy on and
 * one place to reason about when asking whether a value could have been printed.
 */
export function line(text = ""): void {
  process.stdout.write(`${text}\n`);
}

export function errorLine(text = ""): void {
  process.stderr.write(`${text}\n`);
}

export function rewrite(text: string): void {
  process.stdout.write(`\r\u001B[K${text}`);
}

export function clearLine(): void {
  process.stdout.write("\r\u001B[K");
}

export function isInteractive(): boolean {
  return process.stdout.isTTY === true;
}

/** Formats a duration the way a person reads one, not the way a profiler does. */
export function elapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;

  const minutes = Math.floor(ms / 60_000);

  return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`;
}
