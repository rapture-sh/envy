import { afterEach, describe, expect, it } from "vitest";
import { clearLine, elapsed, isInteractive, line, rewrite } from "~/ui/out";
import { capture, setInteractive } from "../helpers/output";

const undo: Array<() => void> = [];

afterEach(() => {
  while (undo.length > 0) undo.pop()?.();
});

describe("elapsed", () => {
  it("should show milliseconds under a second", () => {
    expect(elapsed(340)).toBe("340ms");
  });

  it("should show one decimal of seconds under a minute", () => {
    expect(elapsed(1250)).toBe("1.3s");
  });

  it("should show minutes and seconds over a minute", () => {
    expect(elapsed(125_000)).toBe("2m 5s");
  });

  it("should round rather than truncate", () => {
    expect(elapsed(0.6)).toBe("1ms");
  });
});

describe("line", () => {
  it("should end what it writes with a newline", async () => {
    expect(await capture(() => line("hello"))).toBe("hello\n");
  });

  it("should write an empty line when given nothing", async () => {
    expect(await capture(() => line())).toBe("\n");
  });
});

describe("rewrite", () => {
  it("should return to the start of the line and clear it first", async () => {
    expect(await capture(() => rewrite("hello"))).toBe("\r\u001B[Khello");
  });
});

describe("clearLine", () => {
  it("should return to the start of the line and clear it", async () => {
    expect(await capture(() => clearLine())).toBe("\r\u001B[K");
  });
});

describe("isInteractive", () => {
  it("should be true when stdout is a terminal", () => {
    undo.push(setInteractive(true));

    expect(isInteractive()).toBe(true);
  });

  it("should be false when stdout is not a terminal", () => {
    undo.push(setInteractive(false));

    expect(isInteractive()).toBe(false);
  });
});
