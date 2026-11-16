import { defaults } from "./defaults.js";
import { Fail, fail } from "./errors.js";
import { ui } from "./ui/index.js";

/**
 * The whole public surface, assembled in one place.
 *
 * One object rather than loose named exports, because a setup script wants one import line
 * and one thing to autocomplete off. `tests/types/envy.test-d.ts` asserts every public
 * module reaches this object, so adding a module and forgetting to expose it fails the
 * build rather than going unnoticed.
 */
export const envy = {
  defaults,
  fail,
  Fail,
  ui,
} as const;
