## What this changes

<!-- One or two sentences. Link the issue if there is one. -->

## Why

<!-- What problem does it solve? For a spawning or path fix: what actually happens on the
platform you saw it on, and how you know. -->

## Checklist

- [ ] envy is still primitives: no pipeline, no step registry, no config a repository has
      to restructure itself around
- [ ] No value out of `config.yml` can reach stdout, an error, a stack, a step label or
      the committed template
- [ ] Nothing new goes through a shell
- [ ] Anything that can wait forever takes an optional `timeout`, with no default
- [ ] Anything new that warns can be turned off, per call and per run
- [ ] `pnpm check` passes
- [ ] New type surface has a type test that fails without the change
- [ ] Bug fixes have a regression test
- [ ] A changeset is included, if users would notice this
- [ ] Commit messages are `feat: ...` or `fix: ...`, two sentences at most

## Idempotence and no TTY

<!-- Delete if this touches neither. For a writer or a kept value: what you ran twice and
what you asserted was unchanged. For anything that can ask: what happens with no TTY. -->

## Type tests

<!-- What the new or changed type tests assert. If a guarantee got weaker, say which test
was removed and why. -->

## New adapter or format

<!-- Delete if none. What it wraps, what it does on failure, how a test stubs it, and
whether it needed anything new on the envy surface. -->

## New peer dependencies

<!-- None, or: the package, what it does, why it is an optional peer rather than a
dependency, and what stops working without it. -->
