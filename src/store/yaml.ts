import { Fail } from "../errors.js";

type YamlModule = { parse: (text: string) => unknown; stringify: (value: unknown) => string };

let loaded: YamlModule | undefined;

/**
 * `yaml` is an optional peer, so it is imported when something actually needs it rather
 * than at module load. A repository that never reads or writes YAML installs nothing and
 * never reaches this.
 */
export async function yamlModule(): Promise<YamlModule> {
  if (loaded !== undefined) return loaded;

  try {
    loaded = (await import("yaml")) as YamlModule;
  } catch {
    throw new Fail(
      "YAML needs the `yaml` package, which is an optional peer dependency. Install it with `pnpm add -D yaml`.",
    );
  }

  return loaded;
}

/** Only for tests, which load it and then want the next call to go through the catch. */
export function resetYamlModule(): void {
  loaded = undefined;
}

const NEEDS_QUOTING =
  /^$|^[\s>|&*!%@`"'[\]{},#?-]|[:#]\s|\s$|^(?:true|false|null|yes|no|on|off|~)$/iu;

const LOOKS_NUMERIC = /^[+-]?(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;

/**
 * Quote a value only where leaving it bare would change what it means when read back.
 *
 * Conservative on purpose: a config file is read by people as well as by a parser, and a
 * file where every value is in quotes is harder to scan. The cases here are the ones where
 * YAML would otherwise take the value for a number, a boolean, a comment or a structure.
 */
export function quoteValue(value: string): string {
  if (NEEDS_QUOTING.test(value) || LOOKS_NUMERIC.test(value)) {
    return `"${value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
  }

  return value;
}

/** Render a value as YAML, through the same optional peer. */
export async function yamlStringify(value: unknown): Promise<string> {
  const { stringify } = await yamlModule();

  return stringify(value);
}
