---
name: type-guard-auditor
description: Use on a diff before it is merged, or on src/ after a run of changes. Looks for a weakened type guarantee, a leaked value, a shell, a second writer, a default timeout, or a warning that cannot be turned off.
tools: Read, Glob, Grep, Bash
---

Read `.agents/type-guard-auditor.md` and follow it exactly. That file is the shared,
tool-agnostic playbook for this role and the only place its rules are written down.

Then read `AGENTS.md` for the conventions that apply to all work in this repo.
