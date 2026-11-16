import type { CheckOutcome } from "../check.js";
import { dim, green, red, yellow } from "./colour.js";
import { line } from "./out.js";

/**
 * The prerequisite block: every check on its own line, passes and failures together.
 *
 * Passes are printed too, rather than only the failures, because the question somebody has
 * when a setup refuses to start is "what did it actually look at", and a list of four ticks
 * and one cross answers it in one glance.
 */
export function checkReport(outcomes: CheckOutcome[]): void {
  if (outcomes.length === 0) return;

  const width = Math.max(...outcomes.map((outcome) => outcome.name.length));

  line();
  line("prerequisites");

  for (const outcome of outcomes) {
    const name = outcome.name.padEnd(width);

    if (outcome.ok) {
      line(`  ${green("✓")} ${name}  ${dim(outcome.found ?? "ok")}`);
      continue;
    }

    const mark = outcome.optional ? yellow("!") : red("✗");
    const reason = outcome.reason ?? "failed";
    // In front rather than behind, because a reason is a sentence and ends in a full stop.
    const note = outcome.optional ? `optional, ${reason}` : reason;

    line(`  ${mark} ${name}  ${dim(note)}`);

    // Two for the indent, one for the mark, one for the space after it, two for the gap
    // before the reason: a fix lines up under the reason it answers.
    if (outcome.fix !== undefined) line(`${" ".repeat(width + 6)}${dim(outcome.fix)}`);
  }
}
