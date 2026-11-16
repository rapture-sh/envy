const RESET = "\u001B[0m";

const CODES = {
  bold: "\u001B[1m",
  dim: "\u001B[2m",
  red: "\u001B[31m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  cyan: "\u001B[36m",
} as const;

/**
 * Whether to emit ANSI at all, decided per call rather than once at import, so a test can
 * force it either way and a script that redirects its output still gets plain text.
 *
 * `NO_COLOR` wins over `FORCE_COLOR`: the convention at no-color.org is that any non-empty
 * value turns colour off, and a user who sets it means it.
 */
export function colourEnabled(): boolean {
  const { NO_COLOR, FORCE_COLOR } = process.env;

  if (NO_COLOR !== undefined && NO_COLOR !== "") return false;
  if (FORCE_COLOR !== undefined && FORCE_COLOR !== "") return true;

  return process.stdout.isTTY === true;
}

function paint(code: string): (text: string) => string {
  return (text) => (colourEnabled() ? `${code}${text}${RESET}` : text);
}

export const bold = paint(CODES.bold);
export const dim = paint(CODES.dim);
export const red = paint(CODES.red);
export const green = paint(CODES.green);
export const yellow = paint(CODES.yellow);
export const cyan = paint(CODES.cyan);

/** Length of a string as it appears on screen, so an aligned block stays aligned. */
export function visibleLength(text: string): number {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI is the point
  return text.replace(/\u001B\[[0-9;]*m/gu, "").length;
}
