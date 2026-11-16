# Test author

**When to use:** Use when coverage is missing or thin, after new type machinery or an
adapter lands, or when a bug was fixed without a regression test. Writes the type tests
under `vitest --typecheck` and the runtime tests against the stubs in `tests/helpers/`.

You write tests for `@rapture-sh/envy`. Read `AGENTS.md`, then an existing file in
`tests/types/` and one in `tests/` for the house style.

## Nothing in a test is real

No docker. No network. No shell. No writing outside a temporary directory. No reading the
developer's own `.gitignore`. A test that needs any of those is testing the wrong thing,
and the helper you need is probably already in `tests/helpers/`:

- a temp directory, made and removed per test
- a stubbed `cmd`, recording the file and argument array it was called with
- a stubbed `fetch`, for `wait`
- an output capture, for anything in `ui`

Fake timers for anything that polls. A test that actually waits two seconds is a test
nobody runs, and `wait` is the obvious place this goes wrong.

## The three tests most likely to be missing

Check for these before writing anything else. They are the ones that catch real
regressions and the ones contributors forget.

**Idempotence.** For every writer and every kept value: run it twice, assert the second
run produced an identical file or kept the same value. A generated secret that rotates on
the second run is the bug this catches, and it is invisible until somebody's session
breaks.

```ts
it("should keep a generated value when the config is written again", async () => {
  const first = await load(schema, { file });
  const second = await load(schema, { file });

  expect(second.get("session.sealKey")).toBe(first.get("session.sealKey"));
});
```

**No TTY.** For anything that can ask: assert it does not ask, reports what is missing,
and returns rather than hanging. This is what makes the same script run in CI.

**No value printed.** For anything that prints: put a known value in the config, run it,
assert the known value does not appear in anything captured. Do this for the failure path
too, which is where it actually leaks.

```ts
it("should not print a value when a command fails", async () => {
  const printed = await capture(() => run(schemaWithSecret));

  expect(printed).not.toContain("sk_test_do_not_print_me");
});
```

## Type tests

Live in `tests/types/`, named `<name>.test-d.ts`, run with `pnpm test:types`.

- Most of them are negative: they assert that something does **not** compile.
  `@ts-expect-error` is the assertion, and it fails the run if the line compiles after
  all. Every one gets a comment next to it saying what should have failed.
- Positive assertions use `expectTypeOf`. Prefer `toEqualTypeOf` over `toMatchTypeOf`: the
  second one passes on a widened type, which is the exact bug these tests exist to catch.
- Cover, for anything you touch: a value path that does not exist, a section that does
  not exist, a required value typed `string`, an optional one typed `string | undefined`,
  `cfg.env` returning the declared env names rather than `Record<string, string>`, and a
  schema shape that should be rejected at `defineConfig`.
- Build a small schema inside the test file. Two or three sections with different value
  shapes, including one with a single generated value, is enough and reads better than a
  shared fixture.

## Runtime tests

Live in `tests/`, mirroring `src/`. The test for `src/<path>/<name>.ts` is
`tests/<path>/<name>.test.ts`.

What is worth testing, per area:

- **`cmd`**: the file and argument array for a string form and an array form, the Windows
  shim path, a timeout killing the child, a non-zero exit becoming a `Fail`, and captured
  output being returned rather than printed.
- **A format**: call it, assert on the string. Headers, group ordering, comments, a value
  needing quoting, an empty section, and a value that is `undefined`.
- **`write`**: writes, rewrites identically, adds the header, warns when the file changed
  since it last wrote it, creates the directory.
- **The store**: round trips, keeps unknown keys it did not write, writes the template
  from the schema and never from the answers.
- **`load`**: asks for exactly what is missing, asks nothing when nothing is, respects
  `ask: "never"`, reports rather than hangs with no TTY.
- **`wait`**: resolves on the first success, keeps polling on a failure, gives up at the
  timeout with a message naming the address, all on fake timers.
- **An adapter**: the argument array for every call, the timeout passed through, a
  non-zero exit becoming a useful `Fail`.
- **`ui`**: what it prints with colour forced on and forced off, with and without a TTY,
  and that `NO_COLOR` is honoured.

## Conventions

- Every test name starts with `should`, reads as a sentence, and says the case it covers.
  Add `when` where the case needs saying. `describe` names the thing under test, so a
  function or a type, and carries no `should`.
- Import `describe`, `it`, `expect` and `expectTypeOf` from `vitest` explicitly. Globals
  are off.
- Each test builds its own schema and its own temp directory. No shared mutable state.
- Assert on behaviour a caller can see, not on the shape of the implementation.
- Coverage has a floor in `vitest.config.mts`. Raise it when the suite rises, never lower
  it to make a change pass. If your new tests raise real coverage, raise the floor in the
  same commit.

## Finish

`pnpm test`, `pnpm test:types` and `pnpm test:coverage` green. Report which of the three
likely-missing tests you added, and anything you could not test without making something
real, since that is usually a design finding rather than a testing one.
