import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";
import { resolveTimeout } from "./defaults.js";
import { Fail } from "./errors.js";

export type CmdOptions = {
  /** Where to run it. Defaults to the current working directory. */
  cwd?: string;

  /** Added to the current environment rather than replacing it. */
  env?: Record<string, string>;

  /**
   * Milliseconds before the child is killed. There is no default: see `defaults`.
   */
  timeout?: number;

  /** Stream the child's output straight through instead of capturing it. */
  inherit?: boolean;

  /** Return the result for a non-zero exit instead of throwing. */
  allowFailure?: boolean;

  /**
   * Values to blank out of captured output and out of any failure message.
   *
   * Arguments never appear in a message, so this is for the case where the child itself
   * echoes something back. An adapter that passes a credential passes it here too.
   */
  redact?: string[];
};

export type CmdResult = {
  code: number;
  out: string;
  err: string;
};

/**
 * Split a command written as one string. Whitespace only: there is no quote handling and
 * there is not going to be, because the moment this parses quotes it is a small shell.
 * An argument with a space in it goes in the array form.
 */
export function parseCommand(command: string): string[] {
  return command.trim().split(/\s+/u).filter(Boolean);
}

function redactFrom(text: string, secrets: string[]): string {
  return secrets.reduce(
    (redacted, secret) => (secret === "" ? redacted : redacted.split(secret).join("[redacted]")),
    text,
  );
}

const BATCH = new Set([".cmd", ".bat"]);

function isExecutableFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

/**
 * Find what `file` actually is on Windows, where a command is usually a shim rather than
 * an executable: `pnpm` on PATH is `pnpm.cmd`, and PATHEXT is what says so.
 */
function resolveOnWindows(file: string): string | undefined {
  const extensions = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  const candidates = extname(file) === "" ? extensions.map((ext) => file + ext) : [file];
  const directories = isAbsolute(file)
    ? [""]
    : ["", ...(process.env.PATH ?? "").split(delimiter).filter(Boolean)];

  for (const directory of directories) {
    for (const candidate of candidates) {
      const path = directory === "" ? candidate : join(directory, candidate);

      if (isExecutableFile(path)) return path;
    }
  }

  return undefined;
}

/**
 * Escape one argument the way cmd.exe reads it back: quotes doubled out, then every cmd
 * metacharacter carted off behind a caret.
 *
 * Only reached for a batch shim, below, and only ever applied to a whole argument. Nothing
 * is concatenated into a command line by hand.
 */
export function escapeForCmd(argument: string): string {
  const quoted = `"${argument.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\*)$/u, "$1$1")}"`;

  return quoted.replace(/[()%!^"<>&|]/gu, "^$&");
}

type Spawnable = {
  file: string;
  args: string[];
  verbatim: boolean;
};

/**
 * What to actually spawn.
 *
 * Everywhere but Windows this is the command and its arguments, with no shell, which is
 * the whole story. On Windows a `.cmd` or `.bat` shim cannot be spawned at all: Node
 * refuses it outright since the batch argument-injection fix, and the file is not an
 * executable in the first place. cmd.exe has to read it, so every argument is escaped and
 * handed over as one verbatim command line. That is the only place cmd.exe appears, and
 * nothing is ever interpolated into it unescaped.
 *
 * `platform` is a seam for the tests, so the Windows branch is exercised on every runner
 * rather than only on the one that happens to be Windows.
 */
export function spawnable(
  file: string,
  args: string[],
  platform: NodeJS.Platform = process.platform,
): Spawnable {
  if (platform !== "win32") return { file, args, verbatim: false };

  const resolved = resolveOnWindows(file);

  if (resolved === undefined || !BATCH.has(extname(resolved).toLowerCase())) {
    return { file: resolved ?? file, args, verbatim: false };
  }

  const line = [resolved, ...args].map(escapeForCmd).join(" ");

  return {
    file: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", `"${line}"`],
    verbatim: true,
  };
}

/**
 * Run a command. Never through a shell: a string splits on whitespace and an array is
 * passed as it is, so nothing out of a config file can become a command, an argument
 * separator or a redirect.
 *
 * Throws a `Fail` on a non-zero exit unless `allowFailure` is set. The message names the
 * program and the exit code, never the arguments, because an argument may be a credential.
 */
export async function cmd(
  command: string | string[],
  options: CmdOptions = {},
): Promise<CmdResult> {
  const parts = typeof command === "string" ? parseCommand(command) : command;
  const [file, ...args] = parts;

  if (file === undefined) throw new Fail("cmd was given an empty command.");

  const timeout = resolveTimeout(options.timeout);
  const secrets = options.redact ?? [];
  const target = spawnable(file, args);

  return new Promise<CmdResult>((settle, reject) => {
    const child = spawn(target.file, target.args, {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: options.inherit === true ? "inherit" : "pipe",
      windowsVerbatimArguments: target.verbatim,
      windowsHide: true,
    });

    let out = "";
    let err = "";
    let timedOut = false;

    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
      out += chunk;
    });

    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
      err += chunk;
    });

    const timer =
      timeout === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, timeout);

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (timer !== undefined) clearTimeout(timer);

      reject(
        error.code === "ENOENT"
          ? new Fail(`\`${file}\` is not on the PATH. Install it, or open a new shell.`)
          : new Fail(`\`${file}\` could not be started: ${error.message}`),
      );
    });

    child.on("close", (code) => {
      if (timer !== undefined) clearTimeout(timer);

      const result: CmdResult = {
        code: code ?? 1,
        out: redactFrom(out, secrets),
        err: redactFrom(err, secrets),
      };

      if (timedOut) {
        reject(new Fail(`\`${file}\` was still running after ${timeout}ms, so it was stopped.`));

        return;
      }

      if (result.code !== 0 && options.allowFailure !== true) {
        const reason = result.err.trim() === "" ? result.out.trim() : result.err.trim();

        reject(
          new Fail(
            `\`${file}\` exited ${result.code}.${reason === "" ? "" : `\n${reason}`}`.trimEnd(),
          ),
        );

        return;
      }

      settle(result);
    });
  });
}
