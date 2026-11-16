import { bold, cyan, dim, green, red, yellow } from "./colour.js";
import { note, ready } from "./report.js";
import { run } from "./run.js";
import { step } from "./step.js";
import { warn } from "./warn.js";

export const ui = {
  run,
  step,
  ready,
  note,
  warn,
  bold,
  dim,
  red,
  green,
  yellow,
  cyan,
} as const;

export type { ReadyOptions } from "./report.js";
export type { RunOptions } from "./run.js";
export type { Warning, WarnOptions } from "./warn.js";
