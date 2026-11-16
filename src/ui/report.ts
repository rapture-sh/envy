import { bold, cyan, dim, green, visibleLength } from "./colour.js";
import { line } from "./out.js";

export type ReadyOptions = {
  /** The one command to run next, printed under the addresses. */
  next?: string;
};

/**
 * The closing block: every address the setup produced, aligned, and what to run next.
 *
 * Addresses rather than values. Nothing here is secret, and nothing here should be: a
 * caller passing a credential into this is the bug `tests/ui/report.test.ts` guards.
 */
export function ready(addresses: Record<string, string> = {}, options: ReadyOptions = {}): void {
  const names = Object.keys(addresses);
  const width = names.reduce((widest, name) => Math.max(widest, visibleLength(name)), 0);

  line();
  line(green("ready"));

  for (const name of names) {
    const address = addresses[name];

    if (address === undefined) continue;

    line(`  ${dim(name.padEnd(width))}  ${cyan(address)}`);
  }

  if (options.next !== undefined) {
    line();
    line(`  ${bold(options.next)}`);
  }
}

/** A plain line of context, dim, for something that is worth saying and is not a warning. */
export function note(text: string): void {
  line(dim(text));
}
