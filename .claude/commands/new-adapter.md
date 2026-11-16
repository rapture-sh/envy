---
description: Add an adapter around an external CLI, with its failure mapping and stubbed tests
argument-hint: [cli name]
---

Add the `$ARGUMENTS` adapter to this package.

Read `.agents/adapter-builder.md` and follow it in order. Read the CLI's documentation for
the commands you are wrapping **and** for what it does on failure before writing anything.
The failure mapping is the work: an adapter that reports "command failed" has added
nothing over the `cmd` call it replaced.

Pay particular attention to what the CLI exits with when the thing is already done. Many
exit non-zero for "already up", and treating that as a failure makes the whole setup
script non-idempotent.

Stop and ask before adding anything to the envy surface beyond the adapter itself, or
before adding a peer dependency.

Finish with `pnpm check` green, and report what you wrapped, what evidence you had for the
failure mapping, which exits you decided were not failures and why, and anything the CLI
can do that you deliberately did not wrap.
