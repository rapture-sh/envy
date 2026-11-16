import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import type { ValueSpec } from "./define.js";
import { toKebab } from "./naming.js";
import { bold, dim } from "./ui/colour.js";
import { line } from "./ui/out.js";

export type Question = {
  /** The schema's name for the section, used for the heading. */
  section: string;
  /** The schema's title for the section, if it gave one. */
  title?: string;
  /** A line about the whole section. */
  note?: string;
  key: string;
  spec: ValueSpec;
  /** What is already in the config file, if anything. */
  current?: string;
};

/** Section, then value, both in file spelling: the shape the store works in. */
export type Answers = Record<string, Record<string, string>>;

const HINT_LENGTH = 12;

/**
 * What to show beside the question for a value that already has one.
 *
 * Nine characters and an ellipsis: enough to recognise which key is in there, not enough
 * to be worth reading off somebody's screen. This is the only place a stored value is ever
 * put on screen, and it is why it is cut here rather than at the call site.
 */
export function hintFor(current: string): string {
  return current.length > HINT_LENGTH ? `${current.slice(0, 9)}...` : current;
}

class Mutable extends Writable {
  muted = false;

  override _write(
    chunk: unknown,
    _encoding: BufferEncoding,
    done: (error?: Error | null) => void,
  ): void {
    if (!this.muted) process.stdout.write(chunk as string | Uint8Array);

    done();
  }
}

function describe(question: Question): void {
  const { spec } = question;

  if (spec.describe !== undefined) line(`  ${spec.describe}`);
  if (spec.where !== undefined) line(`  ${dim(spec.where)}`);

  if (spec.required !== true && spec.without !== undefined) {
    line(`  ${dim(`Empty and ${spec.without}.`)}`);
  }
}

function promptFor(question: Question): string {
  const label = toKebab(question.key);
  const { current, spec } = question;

  if (current !== undefined && current !== "") {
    return `  ${label} ${dim(`[${hintFor(current)}]`)}: `;
  }

  if (spec.example !== undefined) return `  ${label} ${dim(`(${spec.example})`)}: `;

  return `  ${label}: `;
}

/**
 * Ask for a list of values, a section at a time.
 *
 * Never reached without a terminal: `load` checks that before it gets here, because a
 * question nobody can answer would hang a pipeline forever. Nothing is echoed back but the
 * truncated hint above, and a `secret` value is not echoed as it is typed either.
 *
 * `input` is a seam for the tests, which drive the loop from a stream rather than from a
 * keyboard nobody is sitting at.
 */
export async function ask(
  questions: Question[],
  input: NodeJS.ReadableStream = process.stdin,
): Promise<Answers> {
  const output = new Mutable();
  const prompts = createInterface({ input, output, terminal: true });
  const answers: Answers = {};

  line();
  line(dim("enter keeps what is already there, and empty is a fine answer"));

  let heading: string | undefined;

  try {
    for (const question of questions) {
      if (question.section !== heading) {
        heading = question.section;

        line();
        line(bold(question.title ?? question.section));

        if (question.note !== undefined) line(dim(question.note));
      }

      describe(question);

      const pending = prompts.question(promptFor(question));

      output.muted = question.spec.secret === true;

      const typed = (await pending).trim();

      if (output.muted) {
        output.muted = false;
        line();
      }

      const answer = typed === "" ? (question.current ?? "") : typed;
      const section = toKebab(question.section);

      answers[section] = { ...answers[section], [toKebab(question.key)]: answer };

      line();
    }
  } finally {
    prompts.close();
  }

  return answers;
}
