import { afterEach, describe, expect, it } from "vitest";
import { note, ready } from "~/ui/report";
import { capture, setEnv } from "../helpers/output";

const undo: Array<() => void> = [];

afterEach(() => {
  while (undo.length > 0) undo.pop()?.();
});

function plain(): void {
  undo.push(setEnv("NO_COLOR", "1"));
}

describe("ready", () => {
  it("should print every address it was given", async () => {
    plain();

    const printed = await capture(() => {
      ready({ app: "http://localhost:3000", backend: "http://127.0.0.1:8080" });
    });

    expect(printed).toContain("http://localhost:3000");
    expect(printed).toContain("http://127.0.0.1:8080");
  });

  it("should align the names", async () => {
    plain();

    const printed = await capture(() => {
      ready({ app: "one", dashboard: "two" });
    });

    expect(printed).toContain("  app        one");
    expect(printed).toContain("  dashboard  two");
  });

  it("should print what to run next when there is one", async () => {
    plain();

    const printed = await capture(() => {
      ready({}, { next: "pnpm dev" });
    });

    expect(printed).toContain("pnpm dev");
  });

  it("should print nothing but the heading when there is nothing to show", async () => {
    plain();

    const printed = await capture(() => {
      ready();
    });

    expect(printed.trim()).toBe("ready");
  });
});

describe("note", () => {
  it("should print the text", async () => {
    plain();

    const printed = await capture(() => {
      note("every credential is already answered");
    });

    expect(printed).toContain("every credential is already answered");
  });
});
