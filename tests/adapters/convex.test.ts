import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTempDir } from "../helpers/temp";

const spawned = vi.hoisted(() => vi.fn());

vi.mock("~/cmd", () => ({
  cmd: spawned,
}));

const { call, deploy, list, push, set } = await import("~/adapters/convex");

function answers(result: Partial<{ code: number; out: string; err: string }> = {}): void {
  spawned.mockResolvedValue({ code: 0, out: "", err: "", ...result });
}

function argsOf(at: number): string[] {
  return spawned.mock.calls[at]?.[0] as string[];
}

function lastArgs(): string[] {
  return spawned.mock.calls.at(-1)?.[0] as string[];
}

function lastOptions(): Record<string, unknown> {
  return (spawned.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

afterEach(() => {
  spawned.mockReset();
});

describe("push", () => {
  it("should set every value in the file", async () => {
    answers();

    await withTempDir(async (directory) => {
      const file = join(directory, ".env");

      await writeFile(file, "A=1\nB=2\n", "utf8");

      expect(await push(file)).toEqual(["A", "B"]);
      expect(argsOf(0)).toEqual(["pnpm", "exec", "convex", "env", "set", "A", "1"]);
      expect(argsOf(1)).toEqual(["pnpm", "exec", "convex", "env", "set", "B", "2"]);
    });
  });

  it("should pass each value as its own argument rather than a command line", async () => {
    answers();

    await withTempDir(async (directory) => {
      const file = join(directory, ".env");

      await writeFile(file, 'A="two words; rm -rf /"\n', "utf8");
      await push(file);

      expect(lastArgs().at(-1)).toBe("two words; rm -rf /");
    });
  });

  it("should redact the value it is pushing", async () => {
    answers();

    await withTempDir(async (directory) => {
      const file = join(directory, ".env");

      await writeFile(file, "A=sk_live_abc\n", "utf8");
      await push(file);

      expect(lastOptions().redact).toEqual(["sk_live_abc"]);
    });
  });

  it("should skip the names it was told to", async () => {
    answers();

    await withTempDir(async (directory) => {
      const file = join(directory, ".env");

      await writeFile(file, "A=1\nB=2\n", "utf8");

      expect(await push(file, { skip: ["A"] })).toEqual(["B"]);
    });
  });

  it("should ignore comments and blank lines", async () => {
    answers();

    await withTempDir(async (directory) => {
      const file = join(directory, ".env");

      await writeFile(file, "# a comment\n\nA=1\n", "utf8");

      expect(await push(file)).toEqual(["A"]);
    });
  });

  it("should fail clearly when the file is not there", async () => {
    answers();

    await withTempDir(async (directory) => {
      await expect(push(join(directory, "nope.env"))).rejects.toThrow(/is not there/u);
    });
  });

  it("should do nothing for a file with no values in it", async () => {
    answers();

    await withTempDir(async (directory) => {
      const file = join(directory, ".env");

      await writeFile(file, "# only a comment\n", "utf8");

      expect(await push(file)).toEqual([]);
      expect(spawned).not.toHaveBeenCalled();
    });
  });

  it("should reach the CLI however it was told to", async () => {
    answers();

    await withTempDir(async (directory) => {
      const file = join(directory, ".env");

      await writeFile(file, "A=1\n", "utf8");
      await push(file, { via: ["npx", "convex"] });

      expect(lastArgs().slice(0, 2)).toEqual(["npx", "convex"]);
    });
  });
});

describe("set", () => {
  it("should set one value", async () => {
    answers();

    await set("A", "1");

    expect(lastArgs()).toEqual(["pnpm", "exec", "convex", "env", "set", "A", "1"]);
  });

  it("should redact it", async () => {
    answers();

    await set("A", "sk_live_abc");

    expect(lastOptions().redact).toEqual(["sk_live_abc"]);
  });
});

describe("list", () => {
  it("should give back what the CLI printed", async () => {
    answers({ out: "A=1\n" });

    expect(await list()).toBe("A=1\n");
    expect(lastArgs()).toEqual(["pnpm", "exec", "convex", "env", "list"]);
  });
});

describe("deploy", () => {
  it("should push once rather than staying attached", async () => {
    answers();

    await deploy();

    expect(lastArgs()).toEqual(["pnpm", "exec", "convex", "dev", "--once"]);
  });

  it("should pass the timeout through", async () => {
    answers();

    await deploy({ timeout: 120_000 });

    expect(lastOptions().timeout).toBe(120_000);
  });

  it("should not set a timeout when nothing asked for one", async () => {
    answers();

    await deploy();

    expect(lastOptions()).not.toHaveProperty("timeout");
  });
});

describe("run", () => {
  it("should call a function with JSON arguments", async () => {
    answers({ out: "ok\n" });

    expect(await call("keys:rotate")).toBe("ok");
    expect(lastArgs()).toEqual(["pnpm", "exec", "convex", "run", "keys:rotate", "{}"]);
  });

  it("should pass the arguments it was given", async () => {
    answers();

    await call("users:create", { name: "a" });

    expect(lastArgs().at(-1)).toBe('{"name":"a"}');
  });

  it("should name a component when there is one", async () => {
    answers();

    await call("keys:rotate", {}, { component: "auth" });

    expect(lastArgs()).toEqual([
      "pnpm",
      "exec",
      "convex",
      "run",
      "--component",
      "auth",
      "keys:rotate",
      "{}",
    ]);
  });
});
