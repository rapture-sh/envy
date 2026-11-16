import { readFile } from "node:fs/promises";
import { cmd } from "../cmd.js";
import { Fail } from "../errors.js";
import { parseEnv } from "../parse.js";

export type ConvexOptions = {
  /** Where to run it. Defaults to the current directory. */
  cwd?: string;
  /** Milliseconds before giving up. No default: a first deploy is slow. */
  timeout?: number;
  /** Stream the CLI's output through instead of capturing it. */
  inherit?: boolean;
  /**
   * How to reach the CLI. `pnpm exec convex` by default, so it runs the version the
   * repository pinned rather than whatever is installed globally.
   */
  via?: string[];
};

export type PushOptions = ConvexOptions & {
  /** Names to leave alone, for anything the deployment sets for itself. */
  skip?: string[];
};

export type RunOptions = ConvexOptions & {
  /** The component the function lives in, for a function outside the main one. */
  component?: string;
};

const DEFAULT_VIA = ["pnpm", "exec", "convex"];

function run(
  args: string[],
  options: ConvexOptions & { redact?: string[] },
): ReturnType<typeof cmd> {
  return cmd([...(options.via ?? DEFAULT_VIA), ...args], {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
    ...(options.inherit === undefined ? {} : { inherit: options.inherit }),
    ...(options.redact === undefined ? {} : { redact: options.redact }),
  });
}

/**
 * Push an env file into a deployment.
 *
 * A deployment cannot see the repository's files, so anything running inside it has to be
 * told. One `env set` per name, because the CLI has no bulk form, and every value is
 * passed as its own argument rather than built into a command line.
 *
 * The values go in `redact`, so a CLI that echoes one back does not put it in a failure.
 */
export async function push(file: string, options: PushOptions = {}): Promise<string[]> {
  let text: string;

  try {
    text = await readFile(file, "utf8");
  } catch {
    throw new Fail(`${file} is not there, so there is nothing to push into the deployment.`);
  }

  const skip = new Set(options.skip ?? []);
  const values = Object.entries(parseEnv(text)).filter(([name]) => !skip.has(name));
  const pushed: string[] = [];

  for (const [name, value] of values) {
    await run(["env", "set", name, value], { ...options, redact: [value] });

    pushed.push(name);
  }

  return pushed;
}

/** What the deployment has been told, as the CLI prints it. */
export async function list(options: ConvexOptions = {}): Promise<string> {
  return (await run(["env", "list"], options)).out;
}

/** Set one value. */
export async function set(name: string, value: string, options: ConvexOptions = {}): Promise<void> {
  await run(["env", "set", name, value], { ...options, redact: [value] });
}

/** Push the functions and stop, rather than staying attached the way `dev` does. */
export async function deploy(options: ConvexOptions = {}): Promise<void> {
  await run(["dev", "--once"], options);
}

/** Call a function. The arguments are JSON, passed as one argument. */
export async function call(
  name: string,
  args: unknown = {},
  options: RunOptions = {},
): Promise<string> {
  const parts = ["run"];

  if (options.component !== undefined) parts.push("--component", options.component);

  parts.push(name, JSON.stringify(args));

  return (await run(parts, options)).out.trim();
}

export const convex = { push, list, set, deploy, run: call } as const;
