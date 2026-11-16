import { afterEach, describe, expect, it, vi } from "vitest";
import { Fail } from "~/errors";
import { resetWarnings } from "~/ui/warn";
import { capture, setEnv } from "./helpers/output";

const spawned = vi.hoisted(() => vi.fn());

vi.mock("~/cmd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/cmd")>()),
  cmd: spawned,
}));

const { check, compareVersions, satisfies } = await import("~/check");

type Answer = { code?: number; out?: string; err?: string };

/** Answers each spawn by the program it was asked to run. */
function answering(byProgram: Record<string, Answer>): void {
  spawned.mockImplementation((command: string | string[]) => {
    const parts = typeof command === "string" ? command.trim().split(/\s+/u) : command;
    const answer = byProgram[parts[0] ?? ""];

    if (answer === undefined) return Promise.resolve({ code: 127, out: "", err: "" });

    return Promise.resolve({ code: 0, out: "", err: "", ...answer });
  });
}

const undo: Array<() => void> = [];

afterEach(() => {
  while (undo.length > 0) undo.pop()?.();

  spawned.mockReset();
  resetWarnings();
});

function plain(): void {
  undo.push(setEnv("NO_COLOR", "1"));
}

type Outcomes = Awaited<ReturnType<typeof check>>;

/** Runs the checks with output captured, and hands back both halves. */
async function run(
  checks: Parameters<typeof check>[0],
  options?: Parameters<typeof check>[1],
): Promise<{ outcomes: Outcomes; printed: string }> {
  let outcomes: Outcomes = [];

  const printed = await capture(async () => {
    outcomes = await check(checks, options);
  });

  return { outcomes, printed };
}

describe("compareVersions", () => {
  it("should order by major first", () => {
    expect(compareVersions("3.0.0", "2.9.9")).toBeGreaterThan(0);
  });

  it("should order by minor when the major matches", () => {
    expect(compareVersions("3.9.0", "3.11.0")).toBeLessThan(0);
  });

  it("should treat a missing part as zero", () => {
    expect(compareVersions("3.11", "3.11.0")).toBe(0);
  });
});

describe("satisfies", () => {
  it("should accept a version above the floor", () => {
    expect(satisfies("22.17.0", ">=22")).toBe(true);
  });

  it("should reject a version below the floor", () => {
    expect(satisfies("3.9.2", ">=3.11")).toBe(false);
  });

  it("should accept a version inside a range of two terms", () => {
    expect(satisfies("3.11.5", ">=3.11 <4")).toBe(true);
  });

  it("should reject a version above the ceiling of a range", () => {
    expect(satisfies("4.0.0", ">=3.11 <4")).toBe(false);
  });

  it("should ignore a leading v", () => {
    expect(satisfies("22.0.0", ">=v22")).toBe(true);
  });

  it("should accept a version strictly above the floor", () => {
    expect(satisfies("23.0.0", ">22")).toBe(true);
  });

  it("should reject a version equal to a strict floor", () => {
    expect(satisfies("22.0.0", ">22")).toBe(false);
  });

  it("should accept a version at the ceiling when it is inclusive", () => {
    expect(satisfies("4.0.0", "<=4")).toBe(true);
  });

  it("should accept an exact version when no operator is written", () => {
    expect(satisfies("3.11.0", "3.11")).toBe(true);
  });

  it("should reject a version that is not the exact one asked for", () => {
    expect(satisfies("3.11.1", "=3.11.0")).toBe(false);
  });

  it("should fail for a range with nothing in it", () => {
    expect(() => satisfies("1.0.0", "   ")).toThrow(Fail);
  });

  it("should fail for a range it cannot read", () => {
    expect(() => satisfies("1.0.0", "^1.0.0")).toThrow(Fail);
  });
});

describe("check", () => {
  it("should pass a check whose command exits zero", async () => {
    plain();
    answering({ docker: {} });

    const { outcomes } = await run([{ name: "Docker", run: "docker info" }]);

    expect(outcomes).toEqual([{ name: "Docker", optional: false, ok: true }]);
  });

  it("should fail a check whose command exits non-zero", async () => {
    plain();
    answering({ docker: { code: 1 } });

    await expect(capture(() => check([{ name: "Docker", run: "docker info" }]))).rejects.toThrow(
      Fail,
    );
  });

  it("should run every check even when an earlier one failed", async () => {
    plain();
    answering({ node: { out: "v22.17.0" }, python: { code: 127 }, docker: {} });

    await capture(async () => {
      await expect(
        check([
          { name: "Node", run: "node --version", version: ">=22" },
          { name: "Python", run: "python --version", version: ">=3.11" },
          { name: "Docker", run: "docker info" },
        ]),
      ).rejects.toThrow(Fail);
    });

    expect(spawned).toHaveBeenCalledTimes(3);
  });

  it("should name every failure in one message", async () => {
    plain();
    answering({ python: { code: 127 }, docker: { code: 1 } });

    await capture(async () => {
      await expect(
        check([
          { name: "Python", run: "python --version" },
          { name: "Docker", run: "docker info" },
        ]),
      ).rejects.toThrow(/Python, Docker/u);
    });
  });

  it("should accept a version that satisfies the range", async () => {
    plain();
    answering({ node: { out: "v22.17.0" } });

    const { outcomes } = await run([{ name: "Node", run: "node --version", version: ">=22" }]);

    expect(outcomes[0]).toMatchObject({ ok: true, found: "22.17.0" });
  });

  it("should reject a version below the range and say what it found", async () => {
    plain();
    answering({ python: { out: "Python 3.9.2" } });

    const printed = await capture(async () => {
      await expect(
        check([{ name: "Python", run: "python --version", version: ">=3.11" }]),
      ).rejects.toThrow(Fail);
    });

    expect(printed).toContain("found 3.9.2, needs >=3.11");
  });

  it("should read a version printed to stderr", async () => {
    plain();
    answering({ java: { err: 'openjdk version "17.0.1"' } });

    const { outcomes } = await run([{ name: "Java", run: "java -version", version: ">=17" }]);

    expect(outcomes[0]).toMatchObject({ ok: true, found: "17.0.1" });
  });

  it("should use a match of its own when one is given", async () => {
    plain();
    answering({ weird: { out: "build 2024 toolchain 9.1.0" } });

    const { outcomes } = await run([
      {
        name: "Weird",
        run: "weird --version",
        version: ">=9",
        match: /toolchain (\d+\.\d+\.\d+)/u,
      },
    ]);
    const [outcome] = outcomes;

    expect(outcome).toMatchObject({ ok: true, found: "9.1.0" });
  });

  it("should fail when no version can be read out of the output", async () => {
    plain();
    answering({ quiet: { out: "no numbers here" } });

    const printed = await capture(async () => {
      await expect(
        check([{ name: "Quiet", run: "quiet --version", version: ">=1" }]),
      ).rejects.toThrow(Fail);
    });

    expect(printed).toContain("could not read a version");
  });

  it("should let a check of its own refuse a zero exit", async () => {
    plain();
    answering({ psql: { out: "still starting up" } });

    const printed = await capture(async () => {
      await expect(
        check([
          {
            name: "Postgres",
            run: "psql -c select",
            ok: (result) => result.out.includes("accepting connections"),
          },
        ]),
      ).rejects.toThrow(Fail);
    });

    expect(printed).toContain("the check refused it");
  });

  it("should report an optional check without failing the run", async () => {
    plain();
    answering({ gh: { code: 127 } });

    const { outcomes } = await run([{ name: "GitHub CLI", run: "gh --version", optional: true }]);

    expect(outcomes).toEqual([
      { name: "GitHub CLI", optional: true, ok: false, reason: "gh exited 127" },
    ]);
  });

  it("should return the outcomes instead of throwing when told to", async () => {
    plain();
    answering({ docker: { code: 1 } });

    const { outcomes } = await run([{ name: "Docker", run: "docker info" }], {
      allowFailure: true,
    });

    expect(outcomes).toEqual([
      { name: "Docker", optional: false, ok: false, reason: "docker exited 1" },
    ]);
  });

  it("should print what to do under a failure", async () => {
    plain();
    answering({ python: { code: 127 } });

    const printed = await capture(async () => {
      await expect(
        check([{ name: "Python", run: "python --version", fix: "brew install python@3.11" }]),
      ).rejects.toThrow(Fail);
    });

    expect(printed).toContain("brew install python@3.11");
  });

  it("should pass a timeout through to the command", async () => {
    plain();
    answering({ docker: {} });

    await capture(() => check([{ name: "Docker", run: "docker info", timeout: 5000 }]));

    expect(spawned.mock.calls[0]?.[1]).toMatchObject({ timeout: 5000, allowFailure: true });
  });

  it("should not set a timeout when none was given", async () => {
    plain();
    answering({ docker: {} });

    await capture(() => check([{ name: "Docker", run: "docker info" }]));

    expect(spawned.mock.calls[0]?.[1]).not.toHaveProperty("timeout");
  });

  it("should treat a command that would not run at all as a failure", async () => {
    plain();
    spawned.mockRejectedValue(new Fail("python is not on PATH."));

    const { outcomes } = await run([{ name: "Python", run: "python --version" }], {
      allowFailure: true,
    });

    expect(outcomes[0]).toMatchObject({ ok: false, reason: "python is not on PATH." });
  });

  it("should never print what a command wrote", async () => {
    plain();
    answering({ secretive: { out: "token=sk_live_do_not_print_me" } });

    const printed = await capture(() => check([{ name: "Secretive", run: "secretive --version" }]));

    expect(printed).not.toContain("sk_live_do_not_print_me");
  });

  it("should name the program from a command given as an array", async () => {
    plain();
    answering({ psql: { code: 2 } });

    const { outcomes } = await run([{ name: "Postgres", run: ["psql", "-c", "select 1"] }], {
      allowFailure: true,
    });

    expect(outcomes[0]).toMatchObject({ reason: "psql exited 2" });
  });

  it("should print nothing at all for an empty list", async () => {
    plain();

    const printed = await capture(() => check([]));

    expect(printed).toBe("");
  });
});
