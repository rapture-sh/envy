import { afterEach, describe, expect, it } from "vitest";
import { Fail } from "~/errors";
import { resetSteps, step } from "~/ui/step";
import { capture, setEnv, setInteractive } from "../helpers/output";

const undo: Array<() => void> = [];

afterEach(() => {
  while (undo.length > 0) undo.pop()?.();

  resetSteps();
});

function plain(): void {
  undo.push(setEnv("NO_COLOR", "1"));
  undo.push(setInteractive(false));
}

describe("step", () => {
  it("should return what the work returned", async () => {
    plain();

    const result = await capture(async () => {
      expect(await step("Working", () => 42)).toBe(42);
    });

    expect(result).toContain("Working");
  });

  it("should await work that returns a promise", async () => {
    plain();

    await capture(async () => {
      expect(await step("Working", async () => Promise.resolve("done"))).toBe("done");
    });
  });

  it("should mark a step that finished", async () => {
    plain();

    const printed = await capture(() => step("Installing", () => undefined));

    expect(printed).toContain("✓ Installing");
  });

  it("should mark a step that failed", async () => {
    plain();

    const printed = await capture(async () => {
      await expect(
        step("Installing", () => {
          throw new Fail("no");
        }),
      ).rejects.toThrow("no");
    });

    expect(printed).toContain("✗ Installing");
  });

  it("should rethrow what the work threw", async () => {
    plain();

    const thrown = new Fail("the backend never answered");

    await capture(async () => {
      await expect(step("Waiting", () => Promise.reject(thrown))).rejects.toBe(thrown);
    });
  });

  it("should indent a nested step under its parent", async () => {
    plain();

    const printed = await capture(() => step("Outer", () => step("Inner", () => undefined)));

    expect(printed).toContain("  ✓ Inner");
    expect(printed).toMatch(/^✓ Outer/mu);
  });

  it("should go back to the outer depth after a nested step fails", async () => {
    plain();

    const printed = await capture(async () => {
      await step("Outer", async () => {
        await step("Inner", () => Promise.reject(new Fail("no"))).catch(() => undefined);
        await step("Sibling", () => undefined);
      });
    });

    expect(printed).toContain("  ✗ Inner");
    expect(printed).toContain("  ✓ Sibling");
  });

  it("should print a duration", async () => {
    plain();

    const printed = await capture(() => step("Working", () => undefined));

    expect(printed).toMatch(/\d+ms|\d+\.\d+s/u);
  });
});
