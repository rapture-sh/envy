/**
 * The whole public surface, assembled in one place.
 *
 * One object rather than loose named exports, because a setup script wants one import line
 * and one thing to autocomplete off. `tests/types/envy.test-d.ts` asserts every public
 * module reaches this object, so adding a module and forgetting to expose it fails the
 * build rather than going unnoticed.
 */
export const envy = {} as const;
