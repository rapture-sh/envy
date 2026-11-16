import { PassThrough } from "node:stream";

/**
 * Drives a prompt loop from a stream, so no test needs a keyboard.
 *
 * One line at a time, each on its own turn of the event loop, because readline in terminal
 * mode emits every line in a chunk the moment it arrives. Writing them all up front would
 * mean the second question missed the line meant for it, and the stream is never ended
 * because readline closes along with its input.
 */
export function typing(...lines: string[]): NodeJS.ReadableStream {
  const input = new PassThrough();
  let at = 0;

  const next = (): void => {
    const text = lines[at];

    if (text === undefined) return;

    at += 1;
    input.write(`${text}\n`);
    setTimeout(next, 10);
  };

  setTimeout(next, 10);

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
