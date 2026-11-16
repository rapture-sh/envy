import { PassThrough } from "node:stream";

/**
 * Drives a prompt loop from a stream, so no test needs a keyboard.
 *
 * Nothing is written until the loop is listening, and each line waits for the one before it
 * to have reached the reader. readline in terminal mode takes whatever is already buffered
 * in one read and emits a `line` event per newline it finds, so lines written before `ask`
 * creates its interface arrive as a single chunk: the first answers the first question and
 * the rest land with nothing waiting for them and are dropped. `load` reads and writes
 * files before it asks anything, which on a loaded machine is longer than any fixed delay
 * worth waiting, so this waits for the reader instead of guessing.
 *
 * The write callback is the signal, because for a PassThrough in flowing mode it runs once
 * the chunk has reached the consumer. One turn of the event loop after that, `ask` has
 * registered its next question: everything it does between two questions is synchronous.
 *
 * The stream is never ended, because readline closes along with its input.
 */
export function typing(...lines: string[]): NodeJS.ReadableStream {
  const input = new PassThrough();
  let at = 0;

  const next = (): void => {
    const text = lines[at];

    if (text === undefined) return;

    at += 1;
    input.write(`${text}\n`, () => {
      setImmediate(next);
    });
  };

  input.once("resume", () => {
    setImmediate(next);
  });

  return input;
}

/** Puts a stream in place of the keyboard for one test. Returns the undo. */
export function setStdin(stream: NodeJS.ReadableStream): () => void {
  const before = Object.getOwnPropertyDescriptor(process, "stdin");

  Object.defineProperty(process, "stdin", { value: stream, configurable: true });

  return () => {
    if (before !== undefined) Object.defineProperty(process, "stdin", before);
  };
}
