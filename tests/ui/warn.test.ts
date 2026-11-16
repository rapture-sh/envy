import { afterEach, describe, expect, it } from "vitest";
import { defaults, resetDefaults } from "~/defaults";
import { resetWarnings, setRunWarn, warn, warningsEnabled } from "~/ui/warn";
import { capture, setEnv } from "../helpers/output";

const undo: Array<() => void> = [];

afterEach(() => {
  while (undo.length > 0) undo.pop()?.();

  resetWarnings();
  resetDefaults();
});

describe("warn", () => {
  it("should print the title and the detail", async () => {
    undo.push(setEnv("ENVY_NO_WARN", undefined));

    const printed = await capture(() => {
      warn({ title: "config.yml is not ignored", detail: ["add config.yml to .gitignore"] });
    });

    expect(printed).toContain("config.yml is not ignored");
    expect(printed).toContain("add config.yml to .gitignore");
  });

  it("should say nothing when the call silences it", async () => {
    undo.push(setEnv("ENVY_NO_WARN", undefined));

    const printed = await capture(() => {
      warn({ title: "something" }, { warn: false });
    });

    expect(printed).toBe("");
  });

  it("should say nothing when the run silences it", async () => {
    undo.push(setEnv("ENVY_NO_WARN", undefined));
    setRunWarn(false);

    const printed = await capture(() => {
      warn({ title: "something" });
    });

    expect(printed).toBe("");
  });

  it("should say nothing when the process-wide setting silences it", async () => {
    undo.push(setEnv("ENVY_NO_WARN", undefined));
    defaults({ warn: false });

    const printed = await capture(() => {
      warn({ title: "something" });
    });

    expect(printed).toBe("");
  });

  it("should say nothing when ENVY_NO_WARN is set", async () => {
    undo.push(setEnv("ENVY_NO_WARN", "1"));

    const printed = await capture(() => {
      warn({ title: "something" });
    });

    expect(printed).toBe("");
  });

  it("should let the call turn a warning back on when the environment silenced it", async () => {
    undo.push(setEnv("ENVY_NO_WARN", "1"));

    const printed = await capture(() => {
      warn({ title: "something" }, { warn: true });
    });

    expect(printed).toContain("something");
  });

  it("should warn once for the same cause in one run", async () => {
    undo.push(setEnv("ENVY_NO_WARN", undefined));

    const printed = await capture(() => {
      warn({ title: "the same thing", key: "same" });
      warn({ title: "the same thing", key: "same" });
    });

    expect(printed.split("the same thing")).toHaveLength(2);
  });

  it("should warn again for a different cause", async () => {
    undo.push(setEnv("ENVY_NO_WARN", undefined));

    const printed = await capture(() => {
      warn({ title: "first", key: "one" });
      warn({ title: "second", key: "two" });
    });

    expect(printed).toContain("first");
    expect(printed).toContain("second");
  });
});

describe("warningsEnabled", () => {
  it("should prefer the call over every other setting", () => {
    undo.push(setEnv("ENVY_NO_WARN", "1"));
    defaults({ warn: false });
    setRunWarn(false);

    expect(warningsEnabled({ warn: true })).toBe(true);
  });

  it("should prefer the run over the process-wide setting", () => {
    defaults({ warn: true });
    setRunWarn(false);

    expect(warningsEnabled()).toBe(false);
  });

  it("should be on when nothing says otherwise", () => {
    undo.push(setEnv("ENVY_NO_WARN", undefined));

    expect(warningsEnabled()).toBe(true);
  });
});
