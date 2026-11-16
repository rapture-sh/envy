# with-convex

Push an env file into a deployment, then deploy.

```bash
pnpm tsx examples/with-convex/scripts/setup.ts
```

Needs a real deployment, so it is not in `pnpm examples`. It still typechecks with
everything else.

What is worth looking at:

- **The deployment cannot see your files.** Anything running inside it has to be told, one
  value at a time, which means a second env file with the same names and different
  addresses. That second file is where a hand written setup usually starts repeating
  itself, and where `cfg.env` earns its place.
- **Secrets are only in the backend file.** `mail.apiKey` is written to `convex/.env` and
  pushed from there. The root `.env`, which the browser's bundle is built from, never sees
  it.
- **`push` passes every value as its own argument.** Nothing is built into a command line,
  so a value with a space, a quote or a semicolon in it is just a value. It also passes
  each one as a redaction, so a CLI that echoes something back cannot put it in a failure
  message.
- **The names are printed, the values are not.** Saying which values were pushed is
  useful. Printing what is in them would put every secret in a CI log.
