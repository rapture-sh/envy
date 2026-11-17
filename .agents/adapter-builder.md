# Adapter builder

**When to use:** Use when adding an adapter around an external CLI that setup scripts
routinely shell out to, or reworking an existing one. Covers the wrapper, the failure
messages, the surface entry and the stubbed tests.

You build adapters for `@rapturedotsh/envy`. Read `AGENTS.md`, then `src/adapters/docker.ts`
for the house style, then this file in order.

An adapter is thin on purpose. It is a named, typed, testable way to run a CLI that a
setup script would otherwise run by hand, and the value it adds is three things: the
arguments are correct, the timeout is plumbed, and the failure says what to look at.

## Before you write anything

Read the CLI's own documentation for the commands you are wrapping **and** for what it
does on failure. An adapter that reports "command failed" has added nothing over the
`cmd` call it replaced, and working out what a non-zero exit actually means is most of
the work.

Answer these first, in the pull request if not in a comment:

- What does it print on success, and does anything need to be read back out of it?
- What does it exit with when the thing is already done? Many CLIs exit non-zero for
  "already up", and an adapter that treats that as a failure makes the whole script
  non-idempotent.
- What does it need on the path, and what does the user see if it is missing?
- Does it need a working directory, a config file flag, or an environment variable?

## The shape

```ts
export const docker = {
  compose: {
    async up(options: ComposeOptions = {}): Promise<void> { ... },
  },
};
```

Rules, all of them tested:

1. **It calls `cmd`, never `spawn`.** Calling `spawn` directly bypasses the timeout, the
   Windows shim and the stub every test relies on. There are no exceptions to this.
2. **Every call that can wait takes an optional `timeout`**, passed straight through to
   `cmd`, and **never defaults it**. `defaults()` is how a repository opts into a ceiling.
3. **Arguments are an array, built in the adapter.** Never a string the caller can
   influence, never interpolation, never a shell.
4. **A failure is a `Fail` with a message a human can act on**: what command failed, and
   the thing they would run next (`docker compose logs`, `docker ps`). Include the CLI's
   stderr under that, trimmed, never above it.
5. **Nothing is printed.** An adapter returns or throws. `ui` is the caller's choice, and
   a script wraps the call in `ui.step` itself.
6. **No value out of the config appears in a failure message.** If a call takes a secret,
   the failure names the setting, not the value.

## Steps

1. **`src/adapters/<name>.ts`.** The adapter object, named exports only, no default
   export. One file per adapter.
2. **Failure mapping.** Work through the exits the CLI can produce and decide which are
   real failures, which are "already done" and should return quietly, and which deserve
   their own message.
3. **`src/envy.ts`.** Add it to the surface so it is `envy.<name>.<call>`. The type test
   in `tests/types/envy.test-d.ts` asserts every public module is on the surface, so it
   will fail until you do.
4. **`tests/adapters/<name>.test.ts`.** Against a stubbed `cmd`, from
   `tests/helpers/`. Assert the file and the argument array, in order, for every call.
   Assert the timeout is passed through when given and absent when not. Assert a non-zero
   exit becomes a `Fail` whose message names what to look at. Never run the real CLI.
5. **README.** One row in the pieces table.
6. **An example**, if the adapter is something a reader would want to see in context.
   `examples/with-docker/` is the pattern: it is documented, excluded from `pnpm examples`
   because it needs the real thing, and still has to typecheck.
7. **A changeset.** `pnpm changeset`, minor.

## What not to do

- Do not import the CLI's SDK. envy has no runtime dependencies, and spawning the binary
  the developer already has installed is what keeps it that way.
- Do not add state. An adapter is a set of functions, not a client you construct and hold.
- Do not add a `wait` of your own. `wait.http` and `wait.port` exist, and a script that
  wants to wait for your service composes them.
- Do not catch a failure and continue. The script decides what is fatal.
- Do not print progress. `ui.step` is the caller's call.

## Finish

`pnpm check` green. In the pull request, say what you wrapped, what evidence you had for
the failure mapping, which exits you decided were not failures and why, and anything the
CLI can do that you deliberately did not wrap.
