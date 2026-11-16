import { connect } from "node:net";
import { resolveTimeout } from "./defaults.js";
import { Fail } from "./errors.js";

export type WaitOptions = {
  /**
   * Milliseconds before giving up. There is no default: a machine pulling images for the
   * first time is slow in a way envy cannot predict, and a ceiling that is wrong kills a
   * setup that was about to work. See `defaults`.
   */
  timeout?: number;

  /** Milliseconds between attempts. One second by default. */
  interval?: number;

  /** What to call it in the failure, so the message says what never came up. */
  what?: string;
};

export type HttpWaitOptions = WaitOptions & {
  /** Decides whether a response counts. Any status under 500 by default. */
  ok?: (response: Response) => boolean;
};

export type PortWaitOptions = WaitOptions & {
  host?: string;
};

const DEFAULT_INTERVAL = 1000;
const ATTEMPT_TIMEOUT = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((wake) => {
    setTimeout(wake, ms);
  });
}

async function poll(
  attempt: () => Promise<boolean>,
  target: string,
  options: WaitOptions,
): Promise<void> {
  const timeout = resolveTimeout(options.timeout);
  const interval = options.interval ?? DEFAULT_INTERVAL;
  const what = options.what ?? target;
  const started = Date.now();

  for (;;) {
    if (await attempt()) return;

    const waited = Date.now() - started;

    if (timeout !== undefined && waited + interval >= timeout) {
      throw new Fail(
        `${what} did not answer on ${target} within ${timeout}ms. Its own logs will say why.`,
      );
    }

    await sleep(interval);
  }
}

/**
 * Wait until something answers over HTTP.
 *
 * Anything under 500 counts, because a 404 means the server is up and does not have that
 * route, which is an answer. A health route that is picky about this passes its own `ok`.
 */
export async function http(url: string, options: HttpWaitOptions = {}): Promise<void> {
  const accepts = options.ok ?? ((response: Response) => response.status < 500);

  await poll(
    async () => {
      try {
        return accepts(await fetch(url, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT) }));
      } catch {
        return false;
      }
    },
    url,
    options,
  );
}

/** Wait until something is listening on a port. For anything that does not speak HTTP. */
export async function port(number: number, options: PortWaitOptions = {}): Promise<void> {
  const host = options.host ?? "127.0.0.1";

  await poll(
    () =>
      new Promise<boolean>((answer) => {
        const socket = connect({ port: number, host });
        const give = (result: boolean): void => {
          socket.destroy();
          answer(result);
        };

        socket.setTimeout(ATTEMPT_TIMEOUT);
        socket.once("connect", () => {
          give(true);
        });
        socket.once("timeout", () => {
          give(false);
        });
        socket.once("error", () => {
          give(false);
        });
      }),
    `${host}:${number}`,
    options,
  );
}

export const wait = { http, port } as const;
