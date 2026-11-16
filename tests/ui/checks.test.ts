import { afterEach, describe, expect, it } from "vitest";
import type { CheckOutcome } from "~/check";
import { checkReport } from "~/ui/checks";
import { capture, setEnv } from "../helpers/output";

const undo: Array<() => void> = [];

afterEach(() => {
  while (undo.length > 0) undo.pop()?.();
});

function plain(): void {
  undo.push(setEnv("NO_COLOR", "1"));
}

function coloured(): void {
  undo.push(setEnv("NO_COLOR", undefined));
  undo.push(setEnv("FORCE_COLOR", "1"));
}

const passed: CheckOutcome = { name: "Node", ok: true, optional: false, found: "22.17.0" };

const failed: CheckOutcome = {
  name: "Python",
  ok: false,
  optional: false,
  reason: "found 3.9.2, needs >=3.11",
  fix: "brew install python@3.11",
};

describe("checkReport", () => {
  it("should print the version beside a check that passed", async () => {
    plain();

    const printed = await capture(() => {
      checkReport([passed]);
    });

    expect(printed).toContain("Node");
    expect(printed).toContain("22.17.0");
  });

  it("should say ok for a check that passed without looking for a version", async () => {
    plain();

    const printed = await capture(() => {
      checkReport([{ name: "Docker", ok: true, optional: false }]);
    });

    expect(printed).toContain("Docker");
    expect(printed).toContain("ok");
  });

  it("should print the reason beside a check that failed", async () => {
    plain();

    const printed = await capture(() => {
      checkReport([failed]);
    });

    expect(printed).toContain("found 3.9.2, needs >=3.11");
  });

  it("should print the fix under the reason it answers", async () => {
    plain();

    const printed = await capture(() => {
      checkReport([failed]);
    });

    const [, fix] = printed.trim().split("\n").slice(1);

    expect(fix?.trim()).toBe("brew install python@3.11");
  });

  it("should line the fix up under the reason", async () => {
    plain();

    const printed = await capture(() => {
      checkReport([failed]);
    });

    const [reasonLine, fixLine] = printed.trim().split("\n").slice(1);
    const reasonAt = reasonLine?.indexOf("found 3.9.2");
    const fixAt = fixLine?.indexOf("brew install");

    expect(fixAt).toBe(reasonAt);
  });

  it("should say an optional failure was optional", async () => {
    plain();

    const printed = await capture(() => {
      checkReport([{ name: "Docker", ok: false, optional: true, reason: "docker exited 1" }]);
    });

    expect(printed).toContain("optional, docker exited 1");
  });

  it("should print every check, passes and failures together", async () => {
    plain();

    const printed = await capture(() => {
      checkReport([passed, failed]);
    });

    expect(printed).toContain("Node");
    expect(printed).toContain("Python");
  });

  it("should say so when a failure came with no reason to give", async () => {
    plain();

    const printed = await capture(() => {
      checkReport([{ name: "Mystery", ok: false, optional: false }]);
    });

    expect(printed).toContain("failed");
  });

  it("should print nothing at all when there is nothing to check", async () => {
    plain();

    const printed = await capture(() => {
      checkReport([]);
    });

    expect(printed).toBe("");
  });

  it("should colour the marks when colour is on", async () => {
    coloured();

    const printed = await capture(() => {
      checkReport([passed, failed]);
    });

    expect(printed).toContain("\u001B[");
  });

  it("should print no escape codes when colour is off", async () => {
    plain();

    const printed = await capture(() => {
      checkReport([passed, failed]);
    });

    expect(printed).not.toContain("\u001B[");
  });
});
