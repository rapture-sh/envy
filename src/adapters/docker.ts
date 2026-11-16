import { type CmdResult, cmd } from "../cmd.js";
import { Fail } from "../errors.js";

export type ComposeOptions = {
  /** One or more compose files. Each becomes a `-f`, in the order given. */
  file?: string | string[];
  /** The project name, which is what keeps two checkouts from sharing containers. */
  project?: string;
  /** Where to run it. Defaults to the current directory. */
  cwd?: string;
  /** Milliseconds before giving up. No default: pulling images the first time is slow. */
  timeout?: number;
  /** Stream docker's output through instead of capturing it. */
  inherit?: boolean;
};

export type UpOptions = ComposeOptions & {
  /** Only these services, rather than everything in the file. */
  services?: string[];
  /** Recreate the containers even when they are already up to date. */
  recreate?: boolean;
};

export type DownOptions = ComposeOptions & {
  /** Remove the volumes too, which throws away every database in the stack. */
  volumes?: boolean;
};

export type ExecOptions = ComposeOptions & {
  /** Run as this user inside the container. */
  user?: string;
  /** Values to blank out of the output and out of any failure. */
  redact?: string[];
};

export type LogsOptions = ComposeOptions & {
  /** How many lines from the end. All of them by default. */
  tail?: number;
};

function baseArgs(options: ComposeOptions): string[] {
  const files = options.file === undefined ? [] : [options.file].flat();
  const args = ["compose"];

  for (const file of files) args.push("-f", file);

  if (options.project !== undefined) args.push("-p", options.project);

  return args;
}

function run(args: string[], options: ComposeOptions & { redact?: string[] }): Promise<CmdResult> {
  return cmd(["docker", ...baseArgs(options), ...args], {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
    ...(options.inherit === undefined ? {} : { inherit: options.inherit }),
    ...(options.redact === undefined ? {} : { redact: options.redact }),
  });
}

async function withAdvice<T>(work: () => Promise<T>, advice: string): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof Fail)) throw error;

    throw new Fail(`${error.message}\n${advice}`);
  }
}

/**
 * Whether docker is answering at all.
 *
 * Worth its own call because "docker is not running" is the single most common reason a
 * setup script fails, and the error docker gives for it reads like a networking problem.
 */
export async function available(options: ComposeOptions = {}): Promise<boolean> {
  const result = await run(["version"], { ...options, inherit: false }).catch(() => undefined);

  return result?.code === 0;
}

/** Bring the stack up in the background, which returns once the containers are created. */
export async function up(options: UpOptions = {}): Promise<void> {
  const args = ["up", "-d"];

  if (options.recreate === true) args.push("--force-recreate");

  args.push(...(options.services ?? []));

  await withAdvice(
    () => run(args, options),
    "`docker compose logs` says what went wrong, and Docker Desktop has to be running.",
  );
}

/** Take the stack down. */
export async function down(options: DownOptions = {}): Promise<void> {
  const args = ["down"];

  if (options.volumes === true) args.push("-v");

  await run(args, options);
}

/**
 * Run something inside a service and give back what it printed.
 *
 * Always `-T`: without it docker allocates a TTY, and the output comes back with control
 * characters in it that nothing can parse. This is how `cfg.capture` gets a value a
 * container prints.
 */
export async function exec(
  service: string,
  command: string | string[],
  options: ExecOptions = {},
): Promise<string> {
  const parts = typeof command === "string" ? command.trim().split(/\s+/u) : command;
  const args = ["exec", "-T"];

  if (options.user !== undefined) args.push("-u", options.user);

  args.push(service, ...parts);

  const result = await withAdvice(
    () => run(args, options),
    `\`docker compose logs ${service}\` says what the container is doing.`,
  );

  return result.out.trim();
}

/** What a service has been saying. */
export async function logs(service?: string, options: LogsOptions = {}): Promise<string> {
  const args = ["logs"];

  if (options.tail !== undefined) args.push("--tail", String(options.tail));
  if (service !== undefined) args.push(service);

  return (await run(args, options)).out;
}

/** What is up, as docker prints it. */
export async function ps(options: ComposeOptions = {}): Promise<string> {
  return (await run(["ps"], options)).out;
}

export const docker = {
  available,
  compose: { up, down, exec, logs, ps },
} as const;
