---
name: test-author
description: Use when coverage is missing or thin, after new type machinery or an adapter lands, or when a bug was fixed without a regression test. Writes the type tests under vitest --typecheck and the runtime tests against the stubs in tests/helpers.
tools: Read, Write, Edit, Glob, Grep, Bash
---

Read `.agents/test-author.md` and follow it exactly. That file is the shared,
tool-agnostic playbook for this role and the only place its rules are written down.

Then read `AGENTS.md` for the conventions that apply to all work in this repo.
