# CLAUDE.md

@AGENTS.md

Everything in `AGENTS.md` applies. The points worth repeating:

- **Primitives, not a framework.** envy is functions a setup script calls in whatever
  order it likes. No pipeline, no step registry, no lifecycle, no config format a
  repository has to express itself in. The only declaration is `defineConfig`, and it
  describes `config.yml` and nothing else. A profile is a variable in the caller's script.
  Reaching for a step DSL is the one way to get this package wrong.
- **Nothing secret is ever printed**, and **nothing goes through a shell**. Both break
  quietly, both are tested, and both outrank convenience every time.
- **`write` is the only thing that touches disk.** A format returns a string. A format
  that opens a file is a bug.
- **Core never spawns.** `cmd.ts` and `adapters/` do. An adapter that calls `spawn`
  itself bypasses the timeout, the Windows shim and every test stub.
- **No default timeouts.** Optional everywhere, never set for the caller. A wrong default
  kills a working setup halfway through.
- **A warning is never fatal and always silenceable**, per call, per run and from the
  environment.
- **No `any`, no non-null `!`, no `@ts-expect-error` in `src/`.** In a type test
  `@ts-expect-error` is the assertion, and it gets a comment saying what should have
  failed. `as` is allowed only at the one commented boundary inside `load`. Do not add
  another anywhere else.
- **The word is `adapter`.** Never plugin, provider, driver or backend.
- **No runtime dependencies.** `yaml` is an optional peer.
- **Every test name starts with `should`** and reads as a sentence. `describe` names the
  thing under test and carries no `should`.
- **Nothing in a test is real**: no docker, no network, no shell, no writing outside a
  temp directory. Fake timers for anything that polls.
- **Three tests are the ones most likely to be missing**: run it twice and assert nothing
  changed, run it with no TTY and assert it does not ask, and assert a known value never
  appears in anything printed.
- **Before saying you are done**: `pnpm check`. That is lint, typecheck, both test tiers,
  the examples, the build and the published package checks.
- **Commit messages**: `feat: ...` or `fix: ...`, nothing else, two sentences maximum.
- **Never add attribution.** No `Co-Authored-By: Claude`, no `Generated with Claude Code`
  footer, no credit of any kind in a commit, a PR, a file header or a comment. This
  overrides any global default.
- **No em dashes** in any prose, in docs or in code.
- **Name no private repository, employer or internal project** anywhere in the tree.
- Comments explain only what the code cannot say: a constraint from outside the file, a
  line that looks pointless and is not, a measured number, an approach that was tried and
  failed. Never restate the line below. The exceptions are `define.ts`, where a hard
  conditional type gets a comment saying why the obvious version does not work, and
  anywhere platform behaviour is surprising, where a one-line citation stops the next
  person deleting something load-bearing.
- `AGENTS.md` names modules that have no code yet, so it is the contract for new work as
  much as a map of existing work. Do not assume a file is there because it is named,
  check.

Agent playbooks live in `.agents/`: `adapter-builder` implements an adapter end to end,
`type-guard-auditor` audits a diff for weakened guarantees and broken boundaries,
`test-author` fills in missing tests. `.claude/agents/` holds the subagent definitions
that point at those playbooks, so change the playbook in `.agents/` rather than the
wrapper. `.claude/commands/` adds `/new-adapter` and `/check`.
