import { createServer, type Server } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDefaults } from "~/defaults";
import { Fail } from "~/errors";
import { http, port } from "~/wait";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetDefaults();
});

function answering(...statuses: Array<number | "refused">): ReturnType<typeof vi.fn> {
  const attempt = vi.fn(async () => {
    const next = statuses.length > 1 ? statuses.shift() : statuses[0];

    if (next === "refused") throw new TypeError("fetch failed");

    return new Response(null, { status: next ?? 200 });
  });

  vi.stubGlobal("fetch", attempt);

  return attempt;
}

describe("wait.http", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("should return as soon as it gets an answer", async () => {
    const attempt = answering(200);

    await http("http://127.0.0.1:8080/version");

    expect(attempt).toHaveBeenCalledOnce();
  });

  it("should keep polling while nothing answers", async () => {
    const attempt = answering("refused", "refused", 200);

    const waiting = http("http://127.0.0.1:8080/version", { interval: 1000 });

    await vi.advanceTimersByTimeAsync(3000);
    await waiting;

    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("should treat a 404 as an answer, since the server is clearly up", async () => {
    answering(404);

    await expect(http("http://127.0.0.1:8080/nope")).resolves.toBeUndefined();
  });

  it("should not treat a 503 as an answer", async () => {
    const attempt = answering(503, 503, 200);

    const waiting = http("http://127.0.0.1:8080/version", { interval: 1000 });

    await vi.advanceTimersByTimeAsync(3000);
    await waiting;

    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("should take a rule of its own for what counts", async () => {
    const attempt = answering(404, 200);

    const waiting = http("http://127.0.0.1:8080/version", {
      interval: 1000,
      ok: (response) => response.status === 200,
    });

    await vi.advanceTimersByTimeAsync(2000);
    await waiting;

    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("should give up at the timeout", async () => {
    answering("refused");

    const waiting = http("http://127.0.0.1:8080/version", { interval: 100, timeout: 500 });
    const settled = expect(waiting).rejects.toThrow(Fail);

    await vi.advanceTimersByTimeAsync(1000);
    await settled;
  });

  it("should name the address it waited on", async () => {
    answering("refused");

    const waiting = http("http://127.0.0.1:8080/version", { interval: 100, timeout: 500 });
    const settled = expect(waiting).rejects.toThrow(/127\.0\.0\.1:8080/u);

    await vi.advanceTimersByTimeAsync(1000);
    await settled;
  });

  it("should call the thing what the caller called it", async () => {
    answering("refused");

    const waiting = http("http://127.0.0.1:8080/version", {
      interval: 100,
      timeout: 500,
      what: "the backend",
    });
    const settled = expect(waiting).rejects.toThrow(/the backend/u);

    await vi.advanceTimersByTimeAsync(1000);
    await settled;
  });

  it("should wait forever when nothing set a timeout", async () => {
    const attempt = answering("refused");

    const waiting = http("http://127.0.0.1:8080/version", { interval: 100 });
    let settled = false;

    void waiting.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await vi.advanceTimersByTimeAsync(10_000);

    expect(settled).toBe(false);
    expect(attempt.mock.calls.length).toBeGreaterThan(50);
  });
});

describe("wait.port", () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise((done) => {
      if (server === undefined) {
        done(undefined);

        return;
      }

      server.close(() => done(undefined));
      server = undefined;
    });
  });

  it("should return once something is listening", async () => {
    const listening = createServer();

    server = listening;

    const number = await new Promise<number>((ready) => {
      listening.listen(0, "127.0.0.1", () => {
        const address = listening.address();

        ready(typeof address === "object" && address !== null ? address.port : 0);
      });
    });

    await expect(port(number)).resolves.toBeUndefined();
  });

  it("should give up at the timeout when nothing is listening", async () => {
    await expect(port(1, { interval: 10, timeout: 60 })).rejects.toThrow(Fail);
  });

  it("should name the host and port it waited on", async () => {
    await expect(port(1, { interval: 10, timeout: 60 })).rejects.toThrow(/127\.0\.0\.1:1/u);
  });
});
