# Contributing to @rapturedotsh/envy

Thanks for being here. You do not need permission to start, though opening an issue first
is a good way to talk something through. A new adapter, or a format that `write` should
know how to render, is the most useful place to begin.

## The contract

Read [AGENTS.md](AGENTS.md). It is the actual contract for this repo: layout, code style,
testing conventions, and the rules below in full. Everything here assumes it.

Using an AI agent to help? Point it at `AGENTS.md` and the matching playbook in
`.agents/`. The same rules apply to code it writes, including the one about attribution in
commit messages.

Two rules outrank everything else here.

> **Primitives, not a framework.** envy is a library of functions a setup script calls, in
> the order the script chooses. There is no pipeline, no step registry, no lifecycle and
> no config format a repository has to express itself in. The only declaration is
> `defineConfig`, and it describes `config.yml` and nothing else. If a change means a
> repository has to restructure itself around envy's ideas, it is the wrong change.

> **Nothing secret is printed, and nothing goes through a shell.** A value out of
> `config.yml` must never reach stdout, an error, a stack, a step label or the committed
> template, and must never be able to become a command. Both of these are tested, and
> both are the kind of thing that breaks quietly.

## Good contributions

- **A new adapter.** Something developers routinely shell out to during setup: a database
  CLI, a cloud emulator, a migration tool. It wraps `cmd`, takes a `timeout`, maps a
  failure to a message that says what to look at, and spawns nothing a test cannot stub.
  `.agents/adapter-builder.md` is the playbook.
- **A format.** A renderer that turns a value into a string, the way `env`, `yaml` and
  `json` do. It must touch no disk, so it is testable by calling it.
- **A warning.** Something that is a footgun rather than an error, that envy can detect
  honestly and say in one yellow block, and that can be turned off like the rest.
- **Prompt and output work.** This is the only part of envy a developer actually sees, so
  a clearer question or a better failure message is a real contribution.
- **Windows.** Spawning, path handling and line endings are where this breaks first, and
  the people who notice are usually the ones who can fix it.
- **Documentation.** If something took you an hour to work out, that is a bug in the
  README.

Not sure if an idea fits? Open an issue describing it. That is cheaper than building it
and finding out. The settled non-goals: no pipeline or step DSL, no secret manager, no
remote config, no process supervision, no `.env` runtime loader. envy writes the files and
exits.

## Setup

Node 22+ and pnpm 10+. The version is pinned through `packageManager`, so Corepack picks
it up.

```bash
pnpm install
```

```bash
pnpm test:watch
```

`examples/` holds small fake repositories that use the package the way a caller does,
against `src/` rather than a build. It is the quickest way to see a change from the
outside, and the ones that need nothing running are run in CI:

```bash
pnpm examples
```

They write into a temporary copy, so running them leaves your tree clean.

## Checks

Run this before opening a PR, and make sure it passes:

```bash
pnpm check
```

That is lint, typecheck, the test suite with its coverage floor, the type tests, the
examples, the build, and the published package checks (`publint` and `attw`) in one go.
The parts, when one of them fails and you want a shorter loop:

```bash
pnpm lint
```

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm test:types
```

Formatting is Biome's call, not yours: `pnpm lint:fix` rather than arguing with it. A
pre-commit hook formats staged files, so a commit should never fail on formatting alone.

## Tests

Two tiers.

**Runtime tests** live in `tests/`, in a tree that mirrors `src/`. Nothing in them is
real: no docker, no network, no shell, no writing outside a temporary directory. `cmd` is
tested against a stubbed spawn, `wait` against a stubbed fetch with fake timers, a format
by calling it and asserting on the string, the store against a temp directory.

**Type tests** live in `tests/types/` and run under `vitest --typecheck`. Most of them are
negative: they assert that `cfg.get("stripe.typo")` does not compile. A feature that adds
type surface is not done until a type test would fail without it.

Every test name starts with `should`. Coverage has a floor in `vitest.config.mts`: raise
it when the suite rises, never lower it to make a change pass. See `AGENTS.md` for the
rest.

Two things every contribution touching a writer or a kept value has to prove:

- **Idempotence.** Run it twice, assert the second run changed nothing.
- **No TTY.** Assert it does not ask, reports what is missing, and exits cleanly.

## Dependencies

Default answer is no. envy has no runtime dependencies, and the adapters spawn CLIs rather
than importing SDKs, which is what keeps it that way. `yaml` is an **optional peer
dependency**, needed only for the YAML store and the YAML format: installing
`@rapturedotsh/envy` must not install anything.

If something genuinely needs a package, it is an optional peer too. Say so in the PR
description and add it to the peer dependency meta.

## Commits

Commit messages are `feat: ...` or `fix: ...` and **at most two sentences**. No other
prefixes, no essays, no emoji.

```
feat: add the docker compose adapter
fix: keep a generated value when the config file is rewritten
```

No `Co-Authored-By:` trailers and no tool or AI attribution footers, in commit messages or
PR descriptions. The person opening the PR is the author.

Branches: `feat/<short-name>` or `fix/<short-name>`, cut from `main`.

## Pull requests

- One logical change per PR.
- Say what it does and why.
- Type tests for new type surface, a regression test for any bug fixed.
- A changeset (`pnpm changeset`) for anything users would notice. Patch for a fix, minor
  for a feature, major for a change to the guarantees in the README.
- Never include a real credential, a real `config.yml`, or anything out of one. If you do
  it by accident, say so and rotate the value.
