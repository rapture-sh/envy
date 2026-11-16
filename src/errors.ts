/**
 * A failure a human is meant to read.
 *
 * `ui.run` prints a `Fail` as a clean message and exits 1. Anything else is a bug in envy
 * or in the calling script, so it is allowed to throw as itself with its stack intact.
 */
export class Fail extends Error {
  override readonly name = "Fail";

  constructor(message: string) {
    super(message);
  }
}

/** Throw a `Fail`. Exists so a caller can write `return fail(...)` in an expression. */
export function fail(message: string): never {
  throw new Fail(message);
}

export function isFail(error: unknown): error is Fail {
  return error instanceof Fail;
}
