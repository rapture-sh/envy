import { dim, green, red } from "./colour.js";
import { clearLine, elapsed, isInteractive, line, rewrite } from "./out.js";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const INTERVAL = 80;

type Frame = {
  label: string;
  depth: number;
  started: number;
  timer: NodeJS.Timeout | undefined;
  /** True once this step's label is on screen as a finished line of its own. */
  settled: boolean;
};

const stack: Frame[] = [];

function pad(depth: number): string {
  return "  ".repeat(depth);
}

/**
 * A spinner animates by rewriting its own line, so only the innermost step can have one.
 * When a step starts inside another, the outer one gives up its line and becomes a static
 * heading above the nested work.
 */
function settle(frame: Frame): void {
  if (frame.settled) return;

  if (frame.timer !== undefined) {
    clearInterval(frame.timer);
    frame.timer = undefined;
    clearLine();
  }

  line(`${pad(frame.depth)}${dim("·")} ${frame.label}`);
  frame.settled = true;
}

function animate(frame: Frame): void {
  let tick = 0;

  const draw = (): void => {
    rewrite(`${pad(frame.depth)}${dim(FRAMES[tick % FRAMES.length] ?? "")} ${frame.label}`);
    tick += 1;
  };

  draw();

  const timer = setInterval(draw, INTERVAL);

  // Nothing should be kept alive by a spinner. If the work finishes and the process has
  // nothing else to do, it exits rather than spinning forever.
  timer.unref();
  frame.timer = timer;
}

function finish(frame: Frame, mark: string): void {
  if (frame.timer !== undefined) {
    clearInterval(frame.timer);
    clearLine();
  }

  line(`${pad(frame.depth)}${mark} ${frame.label} ${dim(elapsed(Date.now() - frame.started))}`);
}

/**
 * Run some work under a label, with a spinner where there is a terminal to animate in and
 * plain lines where there is not. Nested steps indent.
 *
 * The label is whatever the caller passed, so it must never be built from a config value.
 */
export async function step<T>(label: string, work: () => T | Promise<T>): Promise<T> {
  const parent = stack.at(-1);

  if (parent !== undefined) settle(parent);

  const frame: Frame = {
    label,
    depth: stack.length,
    started: Date.now(),
    timer: undefined,
    settled: false,
  };

  stack.push(frame);

  if (isInteractive()) {
    animate(frame);
  } else {
    line(`${pad(frame.depth)}${dim("·")} ${label}`);
    frame.settled = true;
  }

  try {
    const result = await work();

    finish(frame, green("✓"));

    return result;
  } catch (error) {
    finish(frame, red("✗"));

    throw error;
  } finally {
    stack.pop();
  }
}

/** Only for tests. A step that threw always pops itself. */
export function resetSteps(): void {
  for (const frame of stack) {
    if (frame.timer !== undefined) clearInterval(frame.timer);
  }

  stack.length = 0;
}
