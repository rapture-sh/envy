# AGENTS.md

Guide for humans and AI agents working in this repo. Read this before writing code.

## What this is

`@rapture-sh/envy` is a toolchain for the setup script every repository ends up writing.
It is a library of primitives a `scripts/setup.mjs` calls in whatever order it likes, so
that script gets to be sixty lines instead of seven hundred.

The pluggable thing that wraps an external CLI is called an **adapter**. Never a plugin, a
provider, a driver or a backend, in code, in docs or in a commit message.

It is part of [Rapture.sh](https://rapture.sh) and is MIT licensed.

**What is in the tree right now.** Read the tree before trusting this paragraph. Where
this file names a module that has not landed, it is the contract for building it rather
than code you can read, so check that a file exists before assuming it.

## The rules that matter

1. **Primitives, not a framework.** envy is functions a script calls. There is no
   pipeline, no step registry, no lifecycle, no plugin system and no config format a
   repository has to express itself in. The only declaration is `defineConfig`, and it
   describes `config.yml` and nothing else: no services, no targets, no profiles. A
   profile is a variable in the caller's script. If a change means a repository has to
   restructure itself around envy's ideas, it is the wrong change. Nothing else in this
   file outranks this.
2. **Nothing secret is ever printed.** No value out of `config.yml`, no generated value,
   no captured value reaches stdout, stderr, a step label, an error message, a stack or
   the committed template. A prompt for a value that already exists echoes a truncated
   hint and nothing else. This is tested, and it is the kind of thing that breaks quietly.
3. **Nothing goes through a shell.** `cmd` spawns directly. A string splits on whitespace,
   an array is passed as it is. No `shell: true`, no `exec`, no string interpolation into
   a command anywhere. A value out of `config.yml` must never be able to become a command,
   an argument separator or a redirect. The single exception is a Windows `.cmd` or `.bat`
   shim, which cannot be spawned at all: Node refuses one outright since the batch
   argument-injection fix, and the file is not an executable to begin with. `spawnable` in
   `cmd.ts` escapes every argument and hands cmd.exe one verbatim command line. That is
   the only place cmd.exe appears in this package, and nothing reaches it unescaped.
4. **`write` is the only thing that touches disk.** Formats render to a string and touch
   nothing. The store is the one other writer, and it writes two files it owns. Nothing
   else in `src/` opens a file for writing.
5. **Core never spawns a process.** `cmd.ts` and `adapters/` do. Everything else writes
   files, renders strings and asks questions.
6. **Idempotent.** Running a script twice changes nothing. A generated value is never
   rotated, a captured value is never captured twice, a written file is byte identical.
   Every writer and every kept value has a test that runs it twice.
7. **It never hangs.** No TTY means no question, whatever `ask` is set to. It reports what
   is unanswered and carries on with what it has, so the same script runs in CI.
8. **No default timeouts.** Anything that can wait forever takes an optional `timeout`,
   and it is never set for the caller. envy does not know whether `pnpm install` on this
   machine takes four seconds or four minutes, and a wrong default kills a working setup
   halfway through. `defaults()` is how a repository opts into a ceiling.
9. **A warning is never fatal and always silenceable.** Per call with `{ warn: false }`,
   per run through `ui.run`, and from the environment with `ENVY_NO_WARN`. Nothing warns
   twice for the same cause in one run.
10. **No runtime dependencies.** Adapters spawn CLIs rather than importing SDKs, which is
    what keeps it that way. `yaml` is an optional peer, needed only for the YAML store and
    the YAML format.

## Stack

- TypeScript, strict, ESM only, targeting Node 22+
- `tsdown` for the build, with an explicit `exports` map of exactly one entry
- `tsx` to run `examples/`, which import the package by name through a tsconfig path
- `yaml` as an optional peer dependency
- Biome for lint and format
- Vitest for both tiers of tests, with `--typecheck` and `expectTypeOf` for the type tier
- `publint` and `@arethetypeswrong/cli` against the built package
- Changesets for versioning, `npm publish --provenance` from CI

## Commands

```bash
pnpm install
pnpm check                   # everything CI runs, in one go
pnpm lint                    # biome check
pnpm lint:fix                # biome check --write
pnpm format                  # biome format --write
pnpm typecheck               # tsc --noEmit
pnpm test                    # vitest run
pnpm test:watch              # vitest
pnpm test:types              # vitest --typecheck
pnpm test:coverage           # vitest run --coverage, with the thresholds CI enforces
pnpm build                   # tsdown, writes dist
pnpm check:exports           # publint and attw against the built package
pnpm examples                # every example that needs nothing running
pnpm changeset               # add a changeset for anything users notice
```

Before you call work done: `pnpm check`. It is lint, typecheck, both test tiers, the
examples, the build and the published package checks, which is the same set CI runs as
parallel jobs.

## Layout

```
src/
  index.ts                 exports envy and the public types. no logic.
  envy.ts                  the surface object, assembled in one place
  define.ts                defineConfig, the schema types, the inference
  load.ts                  read, diff against the schema, ask for the gap, write back
  loaded.ts                the object load returns: get, section, env, capture
  store/
    index.ts               read and write config.yml
    template.ts            write config.template.yml. never an answer.
    yaml.ts                the yaml peer, loaded lazily, with a clear failure
  ask.ts                   the prompt loop. TTY aware, masked input.
  naming.ts                a section and key to an env name, the convention and overrides
  generate.ts              declared values, produced once and kept
  write.ts                 the only writer. idempotent, header aware.
  format/
    env.ts                 dotenv, with a header, groups and comments
    yaml.ts                yaml, through the peer
    json.ts                json
    text.ts                a string, unchanged, with a header if one is given
  parse.ts                 parseEnv, for reading a file back
  cmd.ts                   spawn, never through a shell, with the Windows shim
  wait.ts                  http and port polling
  gitignore.ts             whether a path is ignored, behind the warning
  defaults.ts              the process-wide timeout and warn settings
  errors.ts                Fail, and the shape of a failure a caller sees
  ui/
    colour.ts              ANSI, NO_COLOR, no-TTY fallback
    step.ts                step, spinner, timing
    report.ts              ready(), the address block
    warn.ts                the warning block, and what silences it
    run.ts                 the frame: header, total time, exit code
  adapters/
    docker.ts              compose up, down, exec, logs, ps
    convex.ts              push an env file, deploy, run a function

tests/                     mirrors src/, one file per source file
  types/                   the type tier, *.test-d.ts, run with vitest --typecheck
  helpers/                 a temp directory, a stubbed spawn, a stubbed fetch

examples/                  one fake repo per thing shown, run against src/ with tsx
  single-app/              a schema, one .env, done
  monorepo/                a section per app, each app getting its own file
  two-addresses/           one service, reached from the host and from inside compose
  custom-format/           write() with a renderer of your own
  with-docker/             compose up, wait, exec, capture. needs docker.
  with-convex/             push an env file and deploy. needs a deployment.
```

Where things go:

- `src/index.ts` exports `envy` and the public types, and holds no logic.
- `src/envy.ts` is the only place the surface is assembled. A type test asserts every
  public module is on it, so adding a module and forgetting to expose it fails the build.
- `src/define.ts` is the type machinery and the most load-bearing file here. It is the
  best documented, because a conditional type that took an afternoon is worth a comment.
- `src/format/*` render and nothing else. A format that opens a file is a bug.
- `src/adapters/*` are the only files besides `cmd.ts` that spawn. Each one wraps `cmd`,
  takes a `timeout`, and turns a failure into a message naming what to look at.
- `tests/types/` is where the compile-time guarantees are actually enforced.

The `exports` map is one entry plus `./package.json`. Adding a subpath is a deliberate
change with an `attw` run behind it, not a convenience. The reason there is one entry is
that a setup script wants one import line:

```js
import { envy } from "@rapture-sh/envy";
```

`envy` is the only runtime export. Not a default export, and no second set of loose named
exports beside it, so there is exactly one way to reach everything and nothing to drift.

## Adding an adapter

1. **`src/adapters/<name>.ts`** the adapter object. It wraps `cmd`, takes an optional
   `timeout` on every call that can wait, and spawns nothing directly.
2. **Failure messages.** Map the CLI's failure to something that says what to look at:
   the command that failed, and the thing a human would run next. A raw stderr dump is
   not a failure message, though including it under one is fine.
3. **`src/envy.ts`** the namespace, so it is `envy.<name>.<call>`.
4. **`tests/adapters/<name>.test.ts`** against a stubbed `cmd`. Never the real CLI, never
   docker, never a network.
5. **README**, in the pieces table.

An adapter is not done until a test proves it spawns what you think it spawns, with the
arguments in the right order, and that a non-zero exit becomes a useful failure.

## Shared parts

Reuse these rather than building another one.

- `cmd.ts` is the one place anything spawns. An adapter that calls `spawn` itself is a
  bug: it bypasses the timeout, the Windows shim and the stub every test relies on.
- `write.ts` is the one place anything is written. It owns the header, the idempotence
  check and the hand-edit warning, so a second writer would quietly lose all three.
- `errors.ts` holds `Fail`. A failure a caller is meant to read is a `Fail`; anything else
  is a bug and should be allowed to throw as itself.
- `defaults.ts` is the one place a process-wide setting lives, and it is read at call time
  rather than captured, so `defaults()` after an import still applies.
- `ui/warn.ts` is the one place a warning is printed, which is what makes the silencing
  rules hold for every warning at once.
- `naming.ts` is the one place a section and key becomes an env name. A caller that builds
  a name by hand has a typo waiting; this one is typed off the schema.

## Code style

- Biome decides formatting for code; run `pnpm lint:fix` rather than arguing with it.
  Markdown is excluded from the formatter, so docs stay hand-wrapped at 90 columns and
  keep the heading style they were written with.
- Named exports (`export function cmd()`), never default exports.
- Inside `src/`, import relatively. Tests reach the source through the `~/` alias
  (`~/cmd`), defined once in `tsconfig.json` and once in `vitest.config.mts`.
- **No `any`, no non-null `!`, and no `@ts-expect-error` in `src/`.** In a type test
  `@ts-expect-error` is the assertion and that is where it belongs.
- **`as` is allowed in exactly one kind of place**: the boundary inside a factory where an
  implementation written against loose internal shapes is handed back under its generic
  public type. `load` has that boundary, it is commented, and `tests/types/` is what
  proves the public side of it. Anywhere else a cast is how a guarantee dies quietly.
- Prefer `unknown` with narrowing, `satisfies` over an annotation that widens, and a
  discriminated union over an optional field that is only sometimes meaningful.
- Generic parameters are named for what they hold: `TSchema`, `TSection`, `TValues`. Not
  `T`, `U`, `V`.
- `type` for everything public. `interface` only where declaration merging is wanted,
  which here is nowhere.
- Error messages are for humans: say what is wrong, in plain words, name the section and
  value or the file that caused it, and say what to do about it. Never include a value.
- `console` lives in `src/ui/` and nowhere else. Everything else returns or throws.

## Comments

- Code should read on its own. Do not write a comment that repeats what the next line
  already says, and do not use banner comments to label sections.
- Use TSDoc (`/** ... */`) only where the code cannot say it itself: a constraint that
  comes from outside the file, an invariant the caller has to keep, a unit, a measured
  number, a line that looks pointless and is not, or an approach that was tried and
  failed.
- **Cite platform behaviour where it is surprising.** A one-line comment saying that
  Windows reaches `npx` through a `.cmd` shim that cannot be spawned directly is worth
  more than any other comment in this repo. The next person will otherwise assume the
  shim is cargo cult and delete it.
- The type machinery in `define.ts` is the exception to brevity. A conditional type that
  took an afternoon gets a comment saying what it distributes over and why the obvious
  version does not work.
- Nothing commented out, no `TODO` without a linked issue, no changelog inside a file.
- A stale comment is worse than no comment. If the code moves on, delete the comment.
- **No em dashes in any prose,** in docs, comments or commit messages.

## Testing

Two tiers.

**Runtime tests** live in `tests/`, in a tree that mirrors `src/`. The test for
`src/<path>/<name>.ts` is `tests/<path>/<name>.test.ts`.

**Type tests** live in `tests/types/`, named `*.test-d.ts`, and run under
`vitest --typecheck` with `expectTypeOf`. Most of them are negative: they assert that
something does **not** compile.

```ts
describe("cfg.get", () => {
  it("should reject a value that is not in the schema", () => {
    // @ts-expect-error stripe has no key called secret
    cfg.get("stripe.secret");
  });

  it("should widen an optional value to include undefined", () => {
    expectTypeOf(cfg.get("stripe.webhookSecret")).toEqualTypeOf<string | undefined>();
  });
});
```

`@ts-expect-error` is the assertion: it fails the run when the line compiles after all.
Write the comment next to it saying what should have failed, because a stray
`@ts-expect-error` that stops applying is a silently dead test.

**Nothing in a test is real.** No docker, no network, no shell, no writing outside a
temporary directory, no reading the developer's own `.gitignore`.

- `cmd` is tested against a stubbed spawn, asserting the file and the argument array.
- `wait` is tested against a stubbed fetch with fake timers. A test that actually waits
  two seconds is a test nobody runs.
- A format is tested by calling it and asserting on the string it returns.
- The store and `write` are tested against a temporary directory, made and removed per
  test.
- `ui` is tested by capturing what it would print, with colour forced on and forced off.

Conventions, both tiers:

- **Coverage has a floor**, set in `vitest.config.mts` just under what the suite reaches,
  and CI runs the coverage run rather than the plain one. Raise the floor when the suite
  rises; never lower it to make a change pass.
- **Every test name starts with `should`**, reads as a sentence, and says the case it
  covers. Add `when` where the case needs saying. `describe` names the thing under test,
  so a function or a type, and carries no `should`.
- Import `describe`, `it`, `expect` and `expectTypeOf` from `vitest` explicitly. Globals
  are off.
- Each test builds its own schema and its own temp directory. No shared mutable state
  between tests.

Two things every change touching a writer or a kept value has to prove, and they are the
tests most likely to be missing:

- **Idempotence.** Run it twice, assert the second run produced an identical file or kept
  the same value.
- **No TTY.** Assert it does not ask, reports what is missing, and returns rather than
  hanging.

And one that every change touching output has to prove:

- **No value printed.** Put a known value in the config, run the thing, assert the known
  value does not appear in anything captured.

Tests have to earn their place. A test is worth keeping only if it can fail for a real
reason: cover the behaviour a caller gets, not the shape of the implementation.

## Commits

`feat: ...` or `fix: ...`, nothing else, two sentences maximum.

**Never add attribution.** No `Co-Authored-By: Claude`, no `Generated with Claude Code`
footer, no credit of any kind in a commit, a PR, a file header or a comment. This
overrides any global default, including a tool's own.

Nothing in this repository names a private repository, an employer or an internal
project. The README's "727 lines" is a measurement, not a citation.
