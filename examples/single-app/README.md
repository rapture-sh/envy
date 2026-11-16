# single-app

The smallest useful setup.

```bash
pnpm example:single
```

A schema with three sections, one `.env`, done. Nothing here has to be asked for, so it
runs start to finish on a machine that has never seen it.

What is worth looking at:

- **`session.sealKey` is generated, not asked for.** Run it twice and the value does not
  change. A setup script that rotated a session key on every run would sign everybody out
  of their own development environment, and the blame would land anywhere but here.
- **`app.port` has a default**, so it is never a question, and the type of
  `cfg.get("app.port")` is `string` rather than `string | undefined`.
- **`analytics.projectToken` is optional** and says what you lose by skipping it, which is
  what `without` is for. With no terminal it is reported as unanswered rather than asked.
- The committed [`config.template.yml`](config.template.yml) was written by envy out of the
  schema. Nothing in it came from an answer.
