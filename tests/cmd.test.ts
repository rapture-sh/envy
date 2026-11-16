import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { cmd, escapeForCmd, parseCommand, spawnable } from "~/cmd";
import { resetDefaults } from "~/defaults";
import { Fail } from "~/errors";

/**
 * A real `.cmd` file on disk, so the Windows batch branch is exercised on every runner
 * rather than only on the one that happens to be Windows. It is never executed.
 */
let shims: string | undefined;

async function shimDirectory(): Promise<string> {
  if (shims === undefined) {
    shims = await mkdtemp(join(tmpdir(), "envy-cmd-"));

    await writeFile(join(shims, "fake-tool.cmd"), "@echo off\n", "utf8");
  }

  return shims;
}

afterAll(async () => {
  if (shims !== undefined) await rm(shims, { recursive: true, force: true });
});

/**
 * The behaviour tests run `node` itself. That is not a shell and not a network, it is the
 * one executable this suite can rely on being there, and it is the only way to prove that
 * what comes back out is what the child actually did.
 */
const node = process.execPath;

afterEach(() => {
  resetDefaults();
});

describe("parseCommand", () => {
  it("should split on whitespace", () => {
    expect(parseCommand("pnpm install")).toEqual(["pnpm", "install"]);
  });

  it("should collapse repeated whitespace", () => {
    expect(parseCommand("pnpm   exec    convex")).toEqual(["pnpm", "exec", "convex"]);
  });

  it("should trim the ends", () => {
    expect(parseCommand("  pnpm install  ")).toEqual(["pnpm", "install"]);
  });

  it("should give nothing back for an empty command", () => {
    expect(parseCommand("   ")).toEqual([]);
  });

  it("should not treat quotes as grouping, since that would make it a shell", () => {
    expect(parseCommand('echo "two words"')).toEqual(["echo", '"two', 'words"']);
  });
});

describe("escapeForCmd", () => {
  it("should quote a plain argument", () => {
    expect(escapeForCmd("install")).toBe('^"install^"');
  });

  it("should escape a quote inside an argument", () => {
    expect(escapeForCmd('a"b')).toContain("\\");
  });

  it("should carry every cmd metacharacter behind a caret", () => {
    const escaped = escapeForCmd("a&b|c>d<e^f%g!h");

    expect(escaped).toContain("^&");
    expect(escaped).toContain("^|");
    expect(escaped).toContain("^>");
    expect(escaped).toContain("^<");
    expect(escaped).toContain("^%");
    expect(escaped).toContain("^!");
  });
});

describe("spawnable", () => {
  it("should pass the command through unchanged away from Windows", () => {
    expect(spawnable("pnpm", ["install"], "linux")).toEqual({
      file: "pnpm",
      args: ["install"],
      verbatim: false,
    });
  });

  it("should spawn a real executable directly on Windows", () => {
    const target = spawnable(node, ["--version"], "win32");

    expect(target.verbatim).toBe(false);
    expect(target.args).toEqual(["--version"]);
  });

  it("should leave an unresolvable command alone on Windows", () => {
    const target = spawnable("envy-definitely-not-a-real-program", [], "win32");

    expect(target).toEqual({
      file: "envy-definitely-not-a-real-program",
      args: [],
      verbatim: false,
    });
  });

  it("should hand a batch shim to cmd.exe on Windows", async () => {
    const shim = join(await shimDirectory(), "fake-tool.cmd");
    const target = spawnable(shim, ["install"], "win32");

    expect(target.file.toLowerCase()).toContain("cmd.exe");
    expect(target.args.slice(0, 3)).toEqual(["/d", "/s", "/c"]);
    expect(target.verbatim).toBe(true);
  });

  it("should escape every part of the command line it hands cmd.exe", async () => {
    const shim = join(await shimDirectory(), "fake-tool.cmd");
    const target = spawnable(shim, ["a&b"], "win32");
    const line = target.args.at(3) ?? "";

    expect(line).toContain("^&");
    expect(line).not.toMatch(/[^^]&/u);
  });
});

describe("cmd", () => {
  it("should capture what the child printed", async () => {
    const result = await cmd([node, "-e", "process.stdout.write('hello')"]);

    expect(result.out).toBe("hello");
    expect(result.code).toBe(0);
  });

  it("should capture what the child printed to stderr", async () => {
    const result = await cmd([node, "-e", "process.stderr.write('oops')"]);

    expect(result.err).toBe("oops");
  });

  it("should accept a command written as one string", async () => {
    const result = await cmd("node --version");

    expect(result.out.trim()).toMatch(/^v\d+/u);
  });

  it("should split a path with a space in it, since the string form is whitespace only", async () => {
    if (!node.includes(" ")) return;

    await expect(cmd(`${node} --version`)).rejects.toThrow(/not on the PATH/u);
  });

  it("should throw a Fail when the child exits non-zero", async () => {
    await expect(cmd([node, "-e", "process.exit(3)"])).rejects.toThrow(Fail);
  });

  it("should name the program and the code in the failure", async () => {
    await expect(cmd([node, "-e", "process.exit(3)"])).rejects.toThrow(/exited 3/u);
  });

  it("should include what the child said about the failure", async () => {
    await expect(
      cmd([node, "-e", "process.stderr.write('no disk'); process.exit(1)"]),
    ).rejects.toThrow(/no disk/u);
  });

  it("should return the result instead of throwing when failure is allowed", async () => {
    const result = await cmd([node, "-e", "process.exit(3)"], { allowFailure: true });

    expect(result.code).toBe(3);
  });

  it("should never put the arguments in a failure message", async () => {
    await expect(cmd([node, "-e", "process.exit(1)", "sk_test_do_not_print_me"])).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("sk_test_do_not_print_me") }),
    );
  });

  it("should blank out a redacted value the child echoed back", async () => {
    const result = await cmd([node, "-e", "process.stdout.write('key=sk_live_abc')"], {
      redact: ["sk_live_abc"],
    });

    expect(result.out).toBe("key=[redacted]");
  });

  it("should blank out a redacted value in a failure message", async () => {
    await expect(
      cmd([node, "-e", "process.stderr.write('bad key sk_live_abc'); process.exit(1)"], {
        redact: ["sk_live_abc"],
      }),
    ).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("sk_live_abc") }),
    );
  });

  it("should ignore an empty string in redact rather than blanking everything", async () => {
    const result = await cmd([node, "-e", "process.stdout.write('hello')"], { redact: [""] });

    expect(result.out).toBe("hello");
  });

  it("should add to the environment rather than replacing it", async () => {
    const result = await cmd([node, "-e", "process.stdout.write(String(process.env.ENVY_TEST))"], {
      env: { ENVY_TEST: "set" },
    });

    expect(result.out).toBe("set");
  });

  it("should run where it was told to", async () => {
    const result = await cmd([node, "-e", "process.stdout.write(process.cwd())"], {
      cwd: process.cwd(),
    });

    expect(result.out).toContain("envy");
  });

  it("should stop a child that outstays its timeout", async () => {
    await expect(
      cmd([node, "-e", "setTimeout(() => undefined, 10000)"], { timeout: 100 }),
    ).rejects.toThrow(/still running after 100ms/u);
  });

  it("should not stop a child that finishes inside its timeout", async () => {
    const result = await cmd([node, "--version"], { timeout: 30_000 });

    expect(result.code).toBe(0);
  });

  it("should fail clearly when the program is not there", async () => {
    await expect(cmd("envy-definitely-not-a-real-program")).rejects.toThrow(/not on the PATH/u);
  });

  it("should refuse an empty command", async () => {
    await expect(cmd("   ")).rejects.toThrow(/empty command/u);
  });

  it("should capture nothing when the output is inherited", async () => {
    const result = await cmd([node, "-e", "process.stdout.write('')"], { inherit: true });

    expect(result.out).toBe("");
  });
});
