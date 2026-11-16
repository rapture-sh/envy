import { cmd } from "./cmd.js";
import { defaults } from "./defaults.js";
import { defineConfig } from "./define.js";
import { Fail, fail } from "./errors.js";
import { env, json, text, yaml } from "./format/index.js";
import { load } from "./load.js";
import { ui } from "./ui/index.js";
import { wait } from "./wait.js";
import { write } from "./write.js";

/**
 * The whole public surface, assembled in one place.
 *
 * One object rather than loose named exports, because a setup script wants one import line
 * and one thing to autocomplete off. `tests/types/envy.test-d.ts` asserts every public
 * module reaches this object, so adding a module and forgetting to expose it fails the
 * build rather than going unnoticed.
 */
export const envy = {
  cmd,
  defaults,
  defineConfig,
  env,
  json,
  text,
  yaml,
  fail,
  Fail,
  load,
  ui,
  wait,
  write,
} as const;
