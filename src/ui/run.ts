import { isFail } from "../errors.js";
import { bold, dim, red } from "./colour.js";
import { elapsed, errorLine, line } from "./out.js";
import { resetSteps } from "./step.js";
import { resetWarnings, setRunWarn } from "./warn.js";

export type RunOptions = {
  /** `false` silences every warning for this run. */
  warn?: boolean;
};

/**
 * The frame around a whole setup script: a heading, the total time, and a failure that
 * reads as a message rather than a stack.
 *
 * A `Fail` is something the person running this is meant to read, so it is printed and the
 * process exits 1. Anything else is a bug in envy or in the script, so it is rethrown with
 * its stack intact rather than flattened into a friendly sentence.
 */
export async function run(
  title: string,
  work: () => void | Promise<void>,
  options: RunOptions = {},
): Promise<void> {
  const started = Date.now();

  setRunWarn(options.warn);

  line();
  line(bold(title));

  try {
    await work();

    line();
    line(dim(`done in ${elapsed(Date.now() - started)}`));
  } catch (error) {
    resetSteps();

    if (!isFail(error)) throw error;

    errorLine();
    errorLine(`${red("failed")} ${error.message}`);

    process.exitCode = 1;
  } finally {
    resetWarnings();
  }
}
