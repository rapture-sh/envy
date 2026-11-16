import { afterEach, describe, expect, it } from "vitest";
import { bold, colourEnabled, dim, visibleLength } from "~/ui/colour";
import { setEnv, setInteractive } from "../helpers/output";

const undo: Array<() => void> = [];

function given(options: { tty?: boolean; noColor?: string; forceColor?: string }): void {
  undo.push(setEnv("NO_COLOR", options.noColor));
  undo.push(setEnv("FORCE_COLOR", options.forceColor));

  if (options.tty !== undefined) undo.push(setInteractive(options.tty));
}

afterEach(() => {
  while (undo.length > 0) undo.pop()?.();
});

describe("colourEnabled", () => {
  it("should be on when there is a terminal", () => {
    given({ tty: true });

    expect(colourEnabled()).toBe(true);
  });

  it("should be off when there is no terminal", () => {
    given({ tty: false });

    expect(colourEnabled()).toBe(false);
  });

  it("should be off when NO_COLOR is set, even with a terminal", () => {
    given({ tty: true, noColor: "1" });

    expect(colourEnabled()).toBe(false);
  });

  it("should ignore an empty NO_COLOR", () => {
    given({ tty: true, noColor: "" });

    expect(colourEnabled()).toBe(true);
  });

  it("should be on when FORCE_COLOR is set without a terminal", () => {
    given({ tty: false, forceColor: "1" });

    expect(colourEnabled()).toBe(true);
  });

  it("should let NO_COLOR win over FORCE_COLOR", () => {
    given({ tty: true, noColor: "1", forceColor: "1" });

    expect(colourEnabled()).toBe(false);
  });
});

describe("the colours", () => {
  it("should wrap text in ANSI when colour is on", () => {
    given({ forceColor: "1" });

    expect(bold("hello")).toBe("\u001B[1mhello\u001B[0m");
  });

  it("should return text unchanged when colour is off", () => {
    given({ noColor: "1" });

    expect(dim("hello")).toBe("hello");
  });
});

describe("visibleLength", () => {
  it("should ignore ANSI when measuring", () => {
    given({ forceColor: "1" });

    expect(visibleLength(bold("hello"))).toBe(5);
  });

  it("should measure plain text as it is", () => {
    expect(visibleLength("hello")).toBe(5);
  });
});
