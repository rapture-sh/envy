import { GENERATED } from "../write.js";

export type EnvValues = Record<string, string | undefined>;

/**
 * Either a flat set of variables or groups of them, or both at once. A value that is a
 * string is a variable, a value that is an object is a group with a heading.
 */
export type EnvInput = Record<string, string | undefined | EnvValues>;

export type EnvOptions = {
  /** Lines above everything, as comments. `false` writes no header at all. */
  header?: string | string[] | false;
};

const DEFAULT_HEADER = `${GENERATED}. Run the setup again rather than editing this file.`;

const BARE = /^[A-Za-z0-9_.\-:/@+=]*$/u;

/**
 * Quote a value only where leaving it bare would change it.
 *
 * Shells, dotenv parsers and docker compose disagree about almost everything, but they all
 * agree on an unquoted run of ordinary characters, and they all agree on a double quoted
 * string with backslash escapes. Staying inside those two is how one file works in all of
 * them.
 */
export function escapeEnvValue(value: string): string {
  if (BARE.test(value)) return value;

  return `"${value
    .replace(/\\/gu, "\\\\")
    .replace(/"/gu, '\\"')
    .replace(/\n/gu, "\\n")
    .replace(/\r/gu, "\\r")}"`;
}

function isGroup(value: string | undefined | EnvValues): value is EnvValues {
  return typeof value === "object" && value !== null;
}

function headerLines(header: EnvOptions["header"]): string[] {
  if (header === false) return [];

  const lines = header === undefined ? [DEFAULT_HEADER] : [header].flat();

  return lines.map((text) => (text === "" ? "#" : `# ${text}`));
}

function variables(values: EnvValues): string[] {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}=${escapeEnvValue(value ?? "")}`);
}

/**
 * Render a dotenv file.
 *
 * A value of `undefined` is left out rather than written as an empty string, because the
 * two mean different things to everything that reads one of these: absent falls back to a
 * default, empty overrides it with nothing.
 */
export function env(input: EnvInput, options: EnvOptions = {}): string {
  const lines = headerLines(options.header);
  const bare: EnvValues = {};

  for (const [name, value] of Object.entries(input)) {
    if (!isGroup(value)) bare[name] = value;
  }

  const top = variables(bare);

  if (top.length > 0) {
    if (lines.length > 0) lines.push("");

    lines.push(...top);
  }

  for (const [name, value] of Object.entries(input)) {
    if (!isGroup(value)) continue;

    const body = variables(value);

    if (body.length === 0) continue;

    lines.push("", `# ${name}`, ...body);
  }

  return `${lines.join("\n")}\n`;
}
