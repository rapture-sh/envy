import { afterEach, describe, expect, it } from "vitest";
import { Fail } from "~/errors";
import { run } from "~/ui/run";
import { warn } from "~/ui/warn";
import { capture, setEnv, setInteractive } from "../helpers/output";

const undo: Array<() => void> = [];

afterEach(() => {
  while (undo.length > 0) undo.pop()?.();

  process.exitCode = undefined;
});

function plain(): void {
  undo.push(setEnv("NO_COLOR", "1"));
  undo.push(setEnv("ENVY_NO_WARN", undefined));
  undo.push(setInteractive(false));
}

describe("run", () => {
  it("should print the title", async () => {
    plain();

    const printed = await capture(() => run("Bootstrap", () => undefined));

    expect(printed).toContain("Bootstrap");
  });

  it("should print how long it took", async () => {
    plain();

    const printed = await capture(() => run("Bootstrap", () => undefined));

    expect(printed).toMatch(/done in \d/u);
  });

  it("should print a failure as a message and exit 1", async () => {
    plain();

    const printed = await capture(() =>
      run("Bootstrap", () => {
        throw new Fail("docker is not answering");
      }),
    );

    expect(printed).toContain("docker is not answering");
    expect(printed).not.toContain("at ");
    expect(process.exitCode).toBe(1);
  });

  it("should rethrow anything that is not a failure", async () => {
    plain();

    await capture(async () => {
      await expect(
        run("Bootstrap", () => {
          throw new TypeError("a bug");
        }),
      ).rejects.toThrow(TypeError);
    });
  });

  it("should leave the exit code alone when the work succeeded", async () => {
    plain();

    await capture(() => run("Bootstrap", () => undefined));

    expect(process.exitCode).toBeUndefined();
  });

  it("should silence warnings for the whole run when told to", async () => {
    plain();

    const printed = await capture(() =>
      run(
        "Bootstrap",
        () => {
          warn({ title: "a footgun" });
        },
        { warn: false },
      ),
    );

    expect(printed).not.toContain("a footgun");
  });

  it("should put the warning setting back when the run ends", async () => {
    plain();

    await capture(() => run("Bootstrap", () => undefined, { warn: false }));

    const printed = await capture(() => {
      warn({ title: "a later footgun" });
    });

    expect(printed).toContain("a later footgun");
  });

  it("should put the warning setting back even when the run failed", async () => {
    plain();

    await capture(() =>
      run(
        "Bootstrap",
        () => {
          throw new Fail("no");
        },
        { warn: false },
      ),
    );

    const printed = await capture(() => {
      warn({ title: "a later footgun" });
    });

    expect(printed).toContain("a later footgun");
  });
});
