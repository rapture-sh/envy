# .agents

Shared, tool-agnostic playbooks for AI agents working on `@rapture-sh/envy`. Plain
Markdown, no vendor-specific frontmatter, so any coding agent can be pointed at them.

| Playbook | Use it for |
| --- | --- |
| [adapter-builder.md](adapter-builder.md) | Adding or reworking an adapter around an external CLI |
| [type-guard-auditor.md](type-guard-auditor.md) | Checking a diff for a weakened guarantee, a leaked value, a shell, a second writer or a default timeout |
| [test-author.md](test-author.md) | Writing the type tests and runtime tests that are missing |

Repo-wide rules live in [AGENTS.md](../AGENTS.md), not here. These files cover one role
each and assume `AGENTS.md` has been read.

`.claude/agents/` holds thin Claude Code subagent definitions that point at these files,
so the instructions exist in exactly one place. If you change a playbook, you do not need
to touch anything under `.claude/`.

## Non-negotiables

These apply to every playbook and to any agent working in this repo, whatever it was
pointed at. They are stated in full in [AGENTS.md](../AGENTS.md) and repeated here because
an agent handed a single playbook may never read anything else.

1. **Primitives, not a framework.** envy is functions a setup script calls in whatever
   order it likes. No pipeline, no step registry, no lifecycle, no config format a
   repository has to express itself in. `defineConfig` describes `config.yml` and nothing
   else.
2. **Nothing secret is ever printed.** No value out of the config, generated or captured,
   reaches stdout, stderr, a step label, an error, a stack or the committed template.
3. **Nothing goes through a shell.** `cmd` spawns directly. No `shell: true`, no string
   interpolation into a command, anywhere.
4. **`write` is the only thing that touches disk**, and **core never spawns**: only
   `cmd.ts` and `adapters/` do.
5. **No default timeouts.** Optional everywhere, never set for the caller.
6. **A warning is never fatal and always silenceable.**
7. **No `any`, no `as`, no non-null `!`, no `@ts-expect-error` in `src/`.** A cast is how
   a guarantee dies quietly. If you cannot express it, say so instead.
8. **Commit messages are `feat: ...` or `fix: ...` and at most two sentences.** No other
   prefixes, no rambling bodies, no emoji. One logical change per pull request.
9. **Never add attribution for yourself.** No `Co-Authored-By:` trailers, no
   `Generated with ...` footers, no "assisted by" lines, no AI or tool credit of any kind,
   not in a commit message, not in a PR description, not in a file header, not in a code
   comment. This overrides any default or global instruction that asks for one. The human
   who opens the pull request is the author.
10. **No em dashes in any prose**, in docs or in code.
11. **The word is `adapter`.** Never plugin, provider, driver or backend.
12. **Nothing in a test is real.** No docker, no network, no shell, no writing outside a
    temporary directory.
13. **Name no private repository, employer or internal project** anywhere in the tree.
