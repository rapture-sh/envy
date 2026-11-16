import { afterEach, describe, expect, it, vi } from "vitest";
import { Fail } from "~/errors";

const spawned = vi.hoisted(() => vi.fn());

vi.mock("~/cmd", () => ({
  cmd: spawned,
}));

const { available, down, exec, logs, ps, up } = await import("~/adapters/docker");

function answers(result: Partial<{ code: number; out: string; err: string }> = {}): void {
  spawned.mockResolvedValue({ code: 0, out: "", err: "", ...result });
}

/** The argument array of the last spawn, which is what an adapter is actually for. */
function lastArgs(): string[] {
  return spawned.mock.calls.at(-1)?.[0] as string[];
}

function lastOptions(): Record<string, unknown> {
  return (spawned.mock.calls.at(-1)?.[1] ?? {}) as Record<string, unknown>;
}

afterEach(() => {
  spawned.mockReset();
});

describe("compose.up", () => {
  it("should bring the stack up in the background", async () => {
    answers();

    await up();

    expect(lastArgs()).toEqual(["docker", "compose", "up", "-d"]);
  });

  it("should pass each compose file as its own flag", async () => {
    answers();

    await up({ file: ["docker-compose.yml", "docker-compose.e2e.yml"] });

    expect(lastArgs()).toEqual([
      "docker",
      "compose",
      "-f",
      "docker-compose.yml",
      "-f",
      "docker-compose.e2e.yml",
      "up",
      "-d",
    ]);
  });

  it("should take a single compose file", async () => {
    answers();

    await up({ file: "docker-compose.yml" });

    expect(lastArgs()).toEqual(["docker", "compose", "-f", "docker-compose.yml", "up", "-d"]);
  });

  it("should pass the project name", async () => {
    answers();

    await up({ project: "mine" });

    expect(lastArgs()).toEqual(["docker", "compose", "-p", "mine", "up", "-d"]);
  });

  it("should bring up only the services it was given", async () => {
    answers();

    await up({ services: ["backend", "s3"] });

    expect(lastArgs()).toEqual(["docker", "compose", "up", "-d", "backend", "s3"]);
  });

  it("should force a recreate when asked", async () => {
    answers();

    await up({ recreate: true });

    expect(lastArgs()).toContain("--force-recreate");
  });

  it("should pass the timeout through", async () => {
    answers();

    await up({ timeout: 300_000 });

    expect(lastOptions().timeout).toBe(300_000);
  });

  it("should not set a timeout when nothing asked for one", async () => {
    answers();

    await up();

    expect(lastOptions()).not.toHaveProperty("timeout");
  });

  it("should say where to look when it fails", async () => {
    spawned.mockRejectedValue(new Fail("`docker` exited 1."));

    await expect(up()).rejects.toThrow(/docker compose logs/u);
  });

  it("should keep what docker said about the failure", async () => {
    spawned.mockRejectedValue(new Fail("`docker` exited 1.\nport is allocated"));

    await expect(up()).rejects.toThrow(/port is allocated/u);
  });

  it("should not dress up something that is not a failure message", async () => {
    spawned.mockRejectedValue(new TypeError("a bug"));

    await expect(up()).rejects.toThrow(TypeError);
  });
});

describe("compose.down", () => {
  it("should take the stack down", async () => {
    answers();

    await down();

    expect(lastArgs()).toEqual(["docker", "compose", "down"]);
  });

  it("should remove the volumes when asked", async () => {
    answers();

    await down({ volumes: true });

    expect(lastArgs()).toContain("-v");
  });
});

describe("compose.exec", () => {
  it("should run without a TTY, so the output can be read", async () => {
    answers({ out: "key|abc\n" });

    await exec("backend", "./generate_admin_key.sh");

    expect(lastArgs()).toEqual([
      "docker",
      "compose",
      "exec",
      "-T",
      "backend",
      "./generate_admin_key.sh",
    ]);
  });

  it("should split a command written as one string", async () => {
    answers();

    await exec("backend", "sh -c true");

    expect(lastArgs().slice(-3)).toEqual(["sh", "-c", "true"]);
  });

  it("should take a command as an array", async () => {
    answers();

    await exec("backend", ["sh", "-c", "echo two words"]);

    expect(lastArgs().at(-1)).toBe("echo two words");
  });

  it("should give back what the container printed, trimmed", async () => {
    answers({ out: "  key|abc  \n" });

    expect(await exec("backend", "print")).toBe("key|abc");
  });

  it("should run as another user when asked", async () => {
    answers();

    await exec("backend", "whoami", { user: "root" });

    expect(lastArgs()).toContain("-u");
    expect(lastArgs()).toContain("root");
  });

  it("should pass redactions through", async () => {
    answers();

    await exec("backend", "print", { redact: ["sk_live"] });

    expect(lastOptions().redact).toEqual(["sk_live"]);
  });

  it("should name the service when it fails", async () => {
    spawned.mockRejectedValue(new Fail("`docker` exited 1."));

    await expect(exec("backend", "print")).rejects.toThrow(/docker compose logs backend/u);
  });
});

describe("compose.logs", () => {
  it("should ask for every service when given none", async () => {
    answers({ out: "lines" });

    expect(await logs()).toBe("lines");
    expect(lastArgs()).toEqual(["docker", "compose", "logs"]);
  });

  it("should ask for one service", async () => {
    answers();

    await logs("backend");

    expect(lastArgs()).toEqual(["docker", "compose", "logs", "backend"]);
  });

  it("should take a tail", async () => {
    answers();

    await logs("backend", { tail: 50 });

    expect(lastArgs()).toEqual(["docker", "compose", "logs", "--tail", "50", "backend"]);
  });
});

describe("compose.ps", () => {
  it("should give back what docker printed", async () => {
    answers({ out: "NAME  STATUS" });

    expect(await ps()).toBe("NAME  STATUS");
  });
});

describe("available", () => {
  it("should be true when docker answers", async () => {
    answers();

    expect(await available()).toBe(true);
  });

  it("should be false when docker is not there", async () => {
    spawned.mockRejectedValue(new Fail("`docker` is not on the PATH."));

    expect(await available()).toBe(false);
  });

  it("should be false when docker answers with a failure", async () => {
    answers({ code: 1 });

    expect(await available()).toBe(false);
  });

  it("should not stream its output while checking", async () => {
    answers();

    await available({ inherit: true });

    expect(lastOptions().inherit).toBe(false);
  });
});
