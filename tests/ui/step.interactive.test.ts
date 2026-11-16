import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Fail } from "~/errors";
import { resetSteps, step } from "~/ui/step";
import { capture, setEnv, setInteractive } from "../helpers/output";

const undo: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers();

  undo.push(setEnv("NO_COLOR", "1"));
  undo.push(setInteractive(true));
});

afterEach(() => {
  vi.useRealTimers();

  while (undo.length > 0) undo.pop()?.();

  resetSteps();
});

describe("step, with a terminal to animate in", () => {
  it("should draw a spinner frame straight away", async () => {
    const printed = await capture(() => step("Installing", () => undefined));

    expect(printed).toContain("\r\u001B[K⠋ Installing");
  });

  it("should keep animating while the work runs", async () => {
    const printed = await capture(async () => {
      const working = step("Installing", async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      await working;
    });

    expect(printed).toContain("⠙ Installing");
  });

  it("should clear the spinner line before the result", async () => {
    const printed = await capture(() => step("Installing", () => undefined));

    expect(printed.endsWith("Installing 0ms\n")).toBe(true);
    expect(printed).toContain("✓ Installing");
  });

  it("should clear the spinner line when the work failed", async () => {
    const printed = await capture(async () => {
      await expect(
        step("Installing", () => {
          throw new Fail("no");
        }),
      ).rejects.toThrow("no");
    });

    expect(printed).toContain("✗ Installing");
  });

  it("should settle the outer step into a static line when a nested one starts", async () => {
    const printed = await capture(() => step("Outer", () => step("Inner", () => undefined)));

    expect(printed).toContain("· Outer");
    expect(printed).toContain("  ✓ Inner");
    expect(printed).toContain("✓ Outer");
  });

  it("should animate the nested step rather than the outer one", async () => {
    const printed = await capture(() => step("Outer", () => step("Inner", () => undefined)));

    expect(printed).toContain("⠋ Inner");
    expect(printed).not.toContain("⠙ Outer");
  });

  it("should settle an outer step only once however many children it has", async () => {
    const printed = await capture(() =>
      step("Outer", async () => {
        await step("First", () => undefined);
        await step("Second", () => undefined);
      }),
    );

    expect(printed.split("· Outer")).toHaveLength(2);
  });

  it("should stop every spinner when the steps are reset", async () => {
    await capture(async () => {
      const working = step("Hanging", () => new Promise(() => undefined));

      void working;
      await vi.advanceTimersByTimeAsync(100);
    });

    resetSteps();

    expect(vi.getTimerCount()).toBe(0);
  });
});
