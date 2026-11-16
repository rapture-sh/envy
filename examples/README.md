# Examples

Small fake repositories, each showing one thing. They run against `src/` rather than a
build, so they break the moment the public surface moves, which is the point of having
them.

| | | |
| --- | --- | --- |
| [single-app](single-app) | `pnpm example:single` | the smallest useful setup: a schema, one `.env`, done |
| [monorepo](monorepo) | `pnpm example:monorepo` | a section per app, each app getting its own file |
| [two-addresses](two-addresses) | `pnpm example:addresses` | one service, reached from the host and from inside compose |
| [custom-format](custom-format) | `pnpm example:custom` | `write()` with a renderer of your own |
| [with-docker](with-docker) | needs docker | compose up, wait, exec, capture what a container prints |
| [with-convex](with-convex) | needs a deployment | push an env file into a deployment and deploy |

The first four run in CI, because they need nothing running. The last two are here to be
read, and are excluded from `pnpm examples` for the obvious reason.

```bash
pnpm examples
```

## What they write

Each one writes into its own directory, and everything they write is gitignored:
`config.yml`, every `.env`, and anything under a `generated/` folder. The one thing they
write that **is** committed is `config.template.yml`, because that is the file a colleague
copies, and having it in the repository is how you can see what the schema produces
without running anything.

Running them leaves your tree clean. If `git status` disagrees after a run, that is a
genuine bug in idempotence and worth an issue.

## No terminal

They are run in CI with no TTY attached. That is deliberate: a setup script that asks a
question nobody can answer hangs a pipeline forever, so the examples prove that envy
reports what is unanswered and carries on instead. Run `pnpm example:monorepo` yourself in
a terminal and the same script asks.
